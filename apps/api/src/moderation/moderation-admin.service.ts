import { Injectable, NotFoundException } from '@nestjs/common';
import { ModerationStatus, RestrictionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ModerationFlagResponseDto } from './dto/moderation-flag-response.dto';
import { ViolationResponseDto } from './dto/violation-response.dto';
import { RestrictionResponseDto } from './dto/restriction-response.dto';
import { AdminNoteResponseDto } from './dto/admin-note-response.dto';

const FLAG_INCLUDE = {
  message: { include: { sender: { include: { profile: true } } } },
  conversation: { include: { property: { select: { title: true } } } },
  reviewedBy: { include: { profile: true } },
} as const;

const DEFAULT_FLAG_STATUSES: ModerationStatus[] = [ModerationStatus.FLAGGED, ModerationStatus.UNDER_REVIEW];

@Injectable()
export class ModerationAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listFlags(status?: ModerationStatus): Promise<ModerationFlagResponseDto[]> {
    const flags = await this.prisma.moderationFlag.findMany({
      where: { status: status ?? { in: DEFAULT_FLAG_STATUSES } },
      include: FLAG_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return flags.map((f) => ModerationFlagResponseDto.from(f));
  }

  async getFlag(id: string): Promise<ModerationFlagResponseDto> {
    const flag = await this.prisma.moderationFlag.findUnique({ where: { id }, include: FLAG_INCLUDE });
    if (!flag) {
      throw new NotFoundException('Moderation flag not found');
    }
    return ModerationFlagResponseDto.from(flag);
  }

  async reviewFlag(
    actor: AuthenticatedUser,
    flagId: string,
    params: { status: ModerationStatus; note?: string },
  ): Promise<ModerationFlagResponseDto> {
    const existing = await this.prisma.moderationFlag.findUnique({ where: { id: flagId } });
    if (!existing) {
      throw new NotFoundException('Moderation flag not found');
    }

    const flag = await this.prisma.moderationFlag.update({
      where: { id: flagId },
      data: {
        status: params.status,
        decision: params.note ?? null,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
      include: FLAG_INCLUDE,
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'moderation.flag_reviewed',
      entityType: 'ModerationFlag',
      entityId: flagId,
      metadata: { status: params.status },
    });

    return ModerationFlagResponseDto.from(flag);
  }

  async listViolationsForUser(userId: string): Promise<ViolationResponseDto[]> {
    const violations = await this.prisma.violation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return violations.map((v) => ViolationResponseDto.from(v));
  }

  async listRestrictionsForUser(userId: string): Promise<RestrictionResponseDto[]> {
    const restrictions = await this.prisma.userRestriction.findMany({
      where: { userId },
      include: { imposedBy: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return restrictions.map((r) => RestrictionResponseDto.from(r));
  }

  async imposeRestriction(
    actor: AuthenticatedUser,
    userId: string,
    params: { type: RestrictionType; reason: string; durationHours?: number },
  ): Promise<RestrictionResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const restriction = await this.prisma.userRestriction.create({
      data: {
        userId,
        type: params.type,
        reason: params.reason,
        imposedById: actor.id,
        startsAt: new Date(),
        endsAt: params.durationHours ? new Date(Date.now() + params.durationHours * 60 * 60 * 1000) : null,
      },
      include: { imposedBy: { include: { profile: true } } },
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'moderation.restriction_imposed',
      entityType: 'UserRestriction',
      entityId: restriction.id,
      metadata: { userId, type: params.type, reason: params.reason },
    });

    return RestrictionResponseDto.from(restriction);
  }

  async liftRestriction(actor: AuthenticatedUser, restrictionId: string): Promise<RestrictionResponseDto> {
    const existing = await this.prisma.userRestriction.findUnique({ where: { id: restrictionId } });
    if (!existing) {
      throw new NotFoundException('Restriction not found');
    }

    const restriction = await this.prisma.userRestriction.update({
      where: { id: restrictionId },
      data: { liftedAt: new Date(), liftedById: actor.id },
      include: { imposedBy: { include: { profile: true } } },
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'moderation.restriction_lifted',
      entityType: 'UserRestriction',
      entityId: restrictionId,
    });

    return RestrictionResponseDto.from(restriction);
  }

  async listNotesForConversation(conversationId: string): Promise<AdminNoteResponseDto[]> {
    const notes = await this.prisma.adminNote.findMany({
      where: { conversationId },
      include: { author: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return notes.map((n) => AdminNoteResponseDto.from(n));
  }

  async addNoteToConversation(
    actor: AuthenticatedUser,
    conversationId: string,
    note: string,
  ): Promise<AdminNoteResponseDto> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const created = await this.prisma.adminNote.create({
      data: { conversationId, authorId: actor.id, note },
      include: { author: { include: { profile: true } } },
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'moderation.note_added',
      entityType: 'Conversation',
      entityId: conversationId,
    });

    return AdminNoteResponseDto.from(created);
  }
}
