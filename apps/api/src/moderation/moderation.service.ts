import { Injectable } from '@nestjs/common';
import { RestrictionType, ViolationAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ContactInfoMatch, detectContactInfo, ModerationResult } from './contact-info-detector.util';

export { ModerationResult, ContactInfoMatch };

const RESTRICTION_HOURS = 24;

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  evaluate(content: string): ModerationResult {
    return detectContactInfo(content);
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
