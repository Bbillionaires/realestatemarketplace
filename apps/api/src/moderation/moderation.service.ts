import { Inject, Injectable } from '@nestjs/common';
import { DetectionMethod, MessageStatus, RestrictionType, ViolationAction, ViolationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ContactInfoMatch, detectContactInfo, ModerationResult } from './contact-info-detector.util';
import { AI_MODERATION_PROVIDER } from './moderation.constants';
import { AiModerationProvider } from './interfaces/ai-moderation-provider.interface';

export { ModerationResult, ContactInfoMatch };

const RESTRICTION_HOURS = 24;
const HISTORY_LOOKBACK_MESSAGES = 5;
const HISTORY_LOOKBACK_MINUTES = 30;
const DISGUISED_SANITIZED_PLACEHOLDER = '[message withheld: possible disguised contact information]';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(AI_MODERATION_PROVIDER) private readonly aiModerationProvider: AiModerationProvider,
  ) {}

  evaluate(content: string): ModerationResult {
    return detectContactInfo(content);
  }

  /**
   * Full evaluation pipeline for a message about to be sent: the pure
   * regex/normalization/keyword rules in detectContactInfo(), then (only if
   * those find nothing) message-history analysis for contact info spread
   * across several messages, then (only if that finds nothing either) the
   * optional AI fallback layer. Each tier only runs if every earlier tier
   * came back clean, per the spec's requirement that AI never be the
   * primary filter.
   */
  async evaluateWithHistory(params: {
    userId: string;
    conversationId: string;
    content: string;
  }): Promise<ModerationResult> {
    const direct = detectContactInfo(params.content);
    if (direct.blocked) {
      return direct;
    }

    const historyMatch = await this.detectSplitAcrossHistory(params);
    if (historyMatch) {
      return { blocked: true, sanitizedContent: DISGUISED_SANITIZED_PLACEHOLDER, matches: [historyMatch] };
    }

    const aiMatch = await this.evaluateAiFallback(params.content);
    if (aiMatch) {
      return { blocked: true, sanitizedContent: DISGUISED_SANITIZED_PLACEHOLDER, matches: [aiMatch] };
    }

    return direct;
  }

  /**
   * Catches contact info deliberately broken across several messages
   * ("call me at... 904... 555... 1234"): joins the sender's own recent
   * messages in this conversation with the new one and re-runs the same
   * deterministic detector over the combined text. Scoped to a short
   * lookback window (message count + elapsed time) so unrelated numbers
   * mentioned much earlier in a long-running conversation (rent, unit
   * numbers) aren't coincidentally stitched together with new digits.
   */
  private async detectSplitAcrossHistory(params: {
    userId: string;
    conversationId: string;
    content: string;
  }): Promise<ContactInfoMatch | null> {
    const since = new Date(Date.now() - HISTORY_LOOKBACK_MINUTES * 60 * 1000);
    const recentMessages = await this.prisma.message.findMany({
      where: {
        conversationId: params.conversationId,
        senderId: params.userId,
        status: { not: MessageStatus.BLOCKED },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LOOKBACK_MESSAGES,
      select: { originalContent: true },
    });
    if (recentMessages.length === 0) {
      return null;
    }

    const combined = [...recentMessages.map((m) => m.originalContent).reverse(), params.content].join(' ');
    const combinedResult = detectContactInfo(combined);
    if (!combinedResult.blocked) {
      return null;
    }

    const worst = [...combinedResult.matches].sort((a, b) => b.confidenceScore - a.confidenceScore)[0];
    return {
      violationType: worst.violationType,
      detectionMethod: DetectionMethod.HISTORY_ANALYSIS,
      // Slightly lower confidence than a direct match: this is inferred
      // from combining several messages, not a single literal match.
      confidenceScore: Math.min(worst.confidenceScore, 0.65),
      snippet: '',
    };
  }

  private async evaluateAiFallback(content: string): Promise<ContactInfoMatch | null> {
    const classification = await this.aiModerationProvider.classify(content);
    if (!classification.flagged) {
      return null;
    }
    return {
      violationType: this.mapAiCategory(classification.category),
      detectionMethod: DetectionMethod.AI_FALLBACK,
      confidenceScore: classification.confidence ?? 0.5,
      snippet: '',
    };
  }

  private mapAiCategory(category: string | undefined): ViolationType {
    const known: string[] = Object.values(ViolationType);
    return known.includes(category ?? '') ? (category as ViolationType) : ViolationType.OFF_PLATFORM_REQUEST;
  }

  async isRestricted(userId: string): Promise<boolean> {
    const active = await this.prisma.userRestriction.findFirst({
      where: {
        userId,
        liftedAt: null,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
    });
    return !!active;
  }

  /**
   * Records a violation for a blocked message and escalates enforcement
   * based on the user's prior violation count:
   *   0 prior -> educational warning
   *   1 prior -> stronger warning
   *   2 prior -> temporary 24h messaging restriction
   *   3+ prior -> flagged for moderator review (no auto-restriction beyond
   *               what's already active)
   * Serious/fraud cases and manual overrides are handled by staff directly
   * via the moderator dashboard (Phase 3), not by this automatic tiering.
   */
  async recordViolationAndEscalate(params: {
    userId: string;
    conversationId: string;
    messageId: string;
    content: string;
    sanitizedContent: string;
    match: ContactInfoMatch;
  }): Promise<ViolationAction> {
    const priorCount = await this.prisma.violation.count({ where: { userId: params.userId } });

    let action: ViolationAction;
    if (priorCount === 0) action = ViolationAction.EDUCATIONAL_WARNING;
    else if (priorCount === 1) action = ViolationAction.STRONG_WARNING;
    else if (priorCount === 2) action = ViolationAction.TEMP_RESTRICTION;
    else action = ViolationAction.MODERATOR_REVIEW;

    await this.prisma.violation.create({
      data: {
        userId: params.userId,
        conversationId: params.conversationId,
        messageId: params.messageId,
        violationType: params.match.violationType,
        detectionMethod: params.match.detectionMethod,
        confidenceScore: params.match.confidenceScore,
        originalContent: params.content,
        sanitizedContent: params.sanitizedContent,
        actionTaken: action,
      },
    });

    if (action === ViolationAction.TEMP_RESTRICTION) {
      await this.prisma.userRestriction.create({
        data: {
          userId: params.userId,
          type: RestrictionType.MESSAGING_RESTRICTED,
          reason: 'Automatic restriction after repeated contact-information violations',
          startsAt: new Date(),
          endsAt: new Date(Date.now() + RESTRICTION_HOURS * 60 * 60 * 1000),
        },
      });
    }

    if (action === ViolationAction.MODERATOR_REVIEW) {
      await this.prisma.moderationFlag.create({
        data: {
          messageId: params.messageId,
          conversationId: params.conversationId,
          flagType: params.match.violationType,
          detectionMethod: params.match.detectionMethod,
          confidenceScore: params.match.confidenceScore,
        },
      });
    }

    await this.auditService.log({
      actorId: params.userId,
      action: 'moderation.message_blocked',
      entityType: 'Message',
      entityId: params.messageId,
      metadata: { violationType: params.match.violationType, actionTaken: action, priorViolationCount: priorCount },
    });

    return action;
  }
}
