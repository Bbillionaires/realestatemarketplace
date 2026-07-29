import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationParticipantRole, ConversationStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { MessagesService } from '../messages/messages.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const TENANT_ROLES: Role[] = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];

const CONVERSATION_INCLUDE = {
  property: { select: { id: true, title: true, addressLine1: true, city: true, state: true } },
  tenant: { include: { profile: true } },
  landlord: { include: { profile: true } },
  relayAssignments: { include: { relayNumber: true } },
} as const;

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  async startConversation(actor: AuthenticatedUser, dto: CreateConversationDto) {
    if (!TENANT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only prospective or current tenants can start a conversation');
    }

    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      include: { managerAssignments: { where: { revokedAt: null }, orderBy: { assignedAt: 'desc' }, take: 1 } },
    });
    if (!property || !property.isActive) {
      throw new NotFoundException('Property not found');
    }
    if (dto.unitId) {
      const unit = await this.prisma.propertyUnit.findFirst({ where: { id: dto.unitId, propertyId: dto.propertyId } });
      if (!unit) {
        throw new BadRequestException('Unit does not belong to this property');
      }
    }

    const landlordId = property.managerAssignments[0]?.userId ?? property.ownerId;

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        propertyId: dto.propertyId,
        tenantId: actor.id,
        status: { notIn: [ConversationStatus.CLOSED, ConversationStatus.BLOCKED] },
      },
      include: CONVERSATION_INCLUDE,
    });

    if (!conversation) {
      const relayNumber = await this.assignRelayNumber();

      const created = await this.prisma.conversation.create({
        data: {
          propertyId: dto.propertyId,
          unitId: dto.unitId ?? null,
          tenantId: actor.id,
          landlordId,
          participants: {
            create: [
              { userId: actor.id, role: ConversationParticipantRole.TENANT },
              {
                userId: landlordId,
                role: property.managerAssignments[0]
                  ? ConversationParticipantRole.PROPERTY_MANAGER
                  : ConversationParticipantRole.LANDLORD,
              },
            ],
          },
          relayAssignments: { create: [{ relayNumberId: relayNumber.id }] },
        },
        include: CONVERSATION_INCLUDE,
      });
      conversation = created;
    }

    const messageResult = await this.messagesService.compose({
      conversationId: conversation.id,
      senderId: actor.id,
      content: dto.message,
    });

    const refreshed = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      include: CONVERSATION_INCLUDE,
    });

    return {
      conversation: ConversationResponseDto.from(refreshed),
      message: messageResult.message,
      delivered: !messageResult.blocked,
      guidance: messageResult.blocked
        ? 'Your message was not delivered because it may contain personal contact or off-platform payment information. Please edit the message and continue communicating through the platform.'
        : undefined,
    };
  }

  async findAllForActor(actor: AuthenticatedUser): Promise<ConversationResponseDto[]> {
    const where = STAFF_ROLES.includes(actor.role)
      ? {}
      : { OR: [{ tenantId: actor.id }, { participants: { some: { userId: actor.id, leftAt: null } } }] };

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: CONVERSATION_INCLUDE,
      orderBy: { lastMessageAt: 'desc' },
    });
    return conversations.map((c) => ConversationResponseDto.from(c));
  }

  async findOneForActor(actor: AuthenticatedUser, id: string): Promise<ConversationResponseDto> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: CONVERSATION_INCLUDE,
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    await this.assertParticipant(actor, conversation.id, conversation.tenantId, conversation.landlordId);
    return ConversationResponseDto.from(conversation);
  }

  async assertParticipant(
    actor: AuthenticatedUser,
    conversationId: string,
    tenantId: string,
    landlordId: string,
  ): Promise<void> {
    if (STAFF_ROLES.includes(actor.role)) return;
    if (actor.id === tenantId || actor.id === landlordId) return;

    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: actor.id, leftAt: null },
    });
    if (!participant) {
      throw new ForbiddenException('You do not have access to this conversation');
    }
  }

  private async assignRelayNumber() {
    const candidates = await this.prisma.relayNumber.findMany({
      where: { isActive: true },
      include: { _count: { select: { assignments: { where: { releasedAt: null } } } } },
    });

    const available = candidates
      .filter((c) => c._count.assignments < c.capacityLimit)
      .sort((a, b) => a._count.assignments - b._count.assignments)[0];

    if (!available) {
      throw new BadRequestException('No relay numbers are currently available. Please try again shortly.');
    }
    return available;
  }
}
