import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, Role, ShowingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ProposeShowingDto } from './dto/propose-showing.dto';
import { ShowingResponseDto } from './dto/showing-response.dto';

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const OPEN_SHOWING_STATUSES: ShowingStatus[] = [
  ShowingStatus.REQUESTED,
  ShowingStatus.SLOT_PROPOSED,
  ShowingStatus.SCHEDULED,
  ShowingStatus.RESCHEDULE_PROPOSED,
];
const SHOWING_INCLUDE = { timeSlots: { orderBy: { startTime: 'asc' as const } } };

@Injectable()
export class ShowingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async propose(actor: AuthenticatedUser, conversationId: string, dto: ProposeShowingDto): Promise<ShowingResponseDto> {
    const conversation = await this.assertParticipant(actor, conversationId);

    const startTime = new Date(dto.startTime);
    if (startTime.getTime() <= Date.now()) {
      throw new BadRequestException('Showing time must be in the future');
    }
    const durationMinutes = dto.durationMinutes ?? 30;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

    let showing = await this.prisma.showing.findFirst({
      where: { conversationId, status: { in: OPEN_SHOWING_STATUSES } },
      include: SHOWING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    if (!showing) {
      showing = await this.prisma.showing.create({
        data: {
          conversationId,
          durationMinutes,
          status: ShowingStatus.REQUESTED,
          timeSlots: { create: [{ proposedBy: actor.id, startTime, endTime }] },
        },
        include: SHOWING_INCLUDE,
      });
    } else {
      await this.prisma.showingTimeSlot.create({
        data: { showingId: showing.id, proposedBy: actor.id, startTime, endTime },
      });
      showing = await this.prisma.showing.update({
        where: { id: showing.id },
        data: { status: ShowingStatus.SLOT_PROPOSED },
        include: SHOWING_INCLUDE,
      });
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.SHOWING_REQUESTED },
    });

    const responseDto = ShowingResponseDto.from(showing);
    this.realtimeGateway.emitShowingUpdated(conversationId, responseDto);
    return responseDto;
  }

  async listForConversation(actor: AuthenticatedUser, conversationId: string): Promise<ShowingResponseDto[]> {
    await this.assertParticipant(actor, conversationId);
    const showings = await this.prisma.showing.findMany({
      where: { conversationId },
      include: SHOWING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return showings.map((s) => ShowingResponseDto.from(s));
  }

  async acceptSlot(
    actor: AuthenticatedUser,
    conversationId: string,
    showingId: string,
    slotId: string,
  ): Promise<ShowingResponseDto> {
    await this.assertParticipant(actor, conversationId);
    const showing = await this.prisma.showing.findFirst({ where: { id: showingId, conversationId } });
    if (!showing) {
      throw new NotFoundException('Showing not found');
    }
    const slot = await this.prisma.showingTimeSlot.findFirst({ where: { id: slotId, showingId } });
    if (!slot) {
      throw new NotFoundException('Time slot not found');
    }

    await this.prisma.$transaction([
      this.prisma.showingTimeSlot.updateMany({ where: { showingId }, data: { isSelected: false } }),
      this.prisma.showingTimeSlot.update({ where: { id: slotId }, data: { isSelected: true } }),
      this.prisma.showing.update({
        where: { id: showingId },
        data: { status: ShowingStatus.SCHEDULED, scheduledAt: slot.startTime },
      }),
    ]);

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.SHOWING_SCHEDULED },
    });

    const updated = await this.prisma.showing.findUniqueOrThrow({
      where: { id: showingId },
      include: SHOWING_INCLUDE,
    });
    const responseDto = ShowingResponseDto.from(updated);
    this.realtimeGateway.emitShowingUpdated(conversationId, responseDto);
    return responseDto;
  }

  async cancel(actor: AuthenticatedUser, conversationId: string, showingId: string): Promise<ShowingResponseDto> {
    await this.assertParticipant(actor, conversationId);
    const showing = await this.prisma.showing.findFirst({ where: { id: showingId, conversationId } });
    if (!showing) {
      throw new NotFoundException('Showing not found');
    }

    const updated = await this.prisma.showing.update({
      where: { id: showingId },
      data: { status: ShowingStatus.CANCELLED, cancelledAt: new Date() },
      include: SHOWING_INCLUDE,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.ACTIVE },
    });

    const responseDto = ShowingResponseDto.from(updated);
    this.realtimeGateway.emitShowingUpdated(conversationId, responseDto);
    return responseDto;
  }

  async complete(actor: AuthenticatedUser, conversationId: string, showingId: string): Promise<ShowingResponseDto> {
    await this.assertParticipant(actor, conversationId);
    const showing = await this.prisma.showing.findFirst({ where: { id: showingId, conversationId } });
    if (!showing) {
      throw new NotFoundException('Showing not found');
    }

    const updated = await this.prisma.showing.update({
      where: { id: showingId },
      data: { status: ShowingStatus.COMPLETED, completedAt: new Date() },
      include: SHOWING_INCLUDE,
    });

    const responseDto = ShowingResponseDto.from(updated);
    this.realtimeGateway.emitShowingUpdated(conversationId, responseDto);
    return responseDto;
  }

  private async assertParticipant(actor: AuthenticatedUser, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (STAFF_ROLES.includes(actor.role)) return conversation;
    if (actor.id === conversation.tenantId || actor.id === conversation.landlordId) return conversation;

    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: actor.id, leftAt: null },
    });
    if (!participant) {
      throw new ForbiddenException('You do not have access to this conversation');
    }
    return conversation;
  }
}
