import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ConversationStatus,
  DeliveryStatus,
  MessageChannel,
  MessageDirection,
  MessageStatus,
  ModerationDecision,
  ModerationStatus,
  Role,
} from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CryptoService } from '../common/utils/crypto.util';
import { ModerationService } from '../moderation/moderation.service';
import { SMS_PROVIDER } from '../sms/sms.constants';
import { SmsProvider } from '../sms/interfaces/sms-provider.interface';
import { MessageResponseDto } from './dto/message-response.dto';
import { anonymizedNumber } from '../common/utils/anonymized-label.util';

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];

const CONVERSATION_WITH_ROUTING_INCLUDE = {
  property: { select: { title: true } },
  tenant: { include: { profile: true } },
  landlord: { include: { profile: true } },
  relayAssignments: { where: { releasedAt: null }, include: { relayNumber: true } },
} as const;

export interface ComposeResult {
  message: MessageResponseDto;
  blocked: boolean;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
    private readonly crypto: CryptoService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  async compose(params: { conversationId: string; senderId: string; content: string }): Promise<ComposeResult> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: params.conversationId },
      include: CONVERSATION_WITH_ROUTING_INCLUDE,
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (![conversation.tenantId, conversation.landlordId].includes(params.senderId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    if (await this.moderationService.isRestricted(params.senderId)) {
      throw new ForbiddenException(
        'Your messaging privileges are temporarily restricted due to prior policy violations.',
      );
    }

    const isSenderTenant = params.senderId === conversation.tenantId;
    const recipientId = isSenderTenant ? conversation.landlordId : conversation.tenantId;
    const isFirstMessage = !conversation.lastMessageAt;

    const moderation = this.moderationService.evaluate(params.content);

    if (moderation.blocked) {
      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: params.senderId,
          recipientId,
          direction: MessageDirection.OUTBOUND,
          channel: MessageChannel.IN_APP,
          originalContent: params.content,
          sanitizedContent: moderation.sanitizedContent,
          moderationDecision: ModerationDecision.BLOCKED,
          status: MessageStatus.BLOCKED,
        },
        include: { sender: { include: { profile: true } } },
      });

      const worstMatch = [...moderation.matches].sort((a, b) => b.confidenceScore - a.confidenceScore)[0];
      await this.moderationService.recordViolationAndEscalate({
        userId: params.senderId,
        conversationId: conversation.id,
        messageId: message.id,
        content: params.content,
        sanitizedContent: moderation.sanitizedContent,
        match: worstMatch,
      });

      if (conversation.moderationStatus === ModerationStatus.NONE) {
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { moderationStatus: ModerationStatus.FLAGGED },
        });
      }

      return { message: MessageResponseDto.from(message, conversation.tenantId), blocked: true };
    }

    let message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: params.senderId,
        recipientId,
        direction: MessageDirection.OUTBOUND,
        channel: MessageChannel.IN_APP,
        originalContent: params.content,
        sanitizedContent: params.content,
        moderationDecision: ModerationDecision.APPROVED,
        status: MessageStatus.QUEUED,
      },
      include: { sender: { include: { profile: true } } },
    });

    const recipientPhone = await this.prisma.phoneNumber.findFirst({
      where: { userId: recipientId, isVerified: true, isPrimary: true },
    });
    const relayNumber = conversation.relayAssignments[0]?.relayNumber;

    if (recipientPhone && relayNumber) {
      const decryptedRecipientPhone = this.crypto.decrypt(recipientPhone.encryptedNumber);
      const body = this.composeNotificationBody({
        recipientIsLandlord: isSenderTenant,
        senderId: params.senderId,
        landlordDisplayName: conversation.landlord.profile?.displayName ?? 'the property manager',
        propertyTitle: conversation.property.title,
        content: params.content,
        isFirstMessage,
      });

      const idempotencyKey = uuid();
      const sendResult = await this.smsProvider.sendMessage({
        to: decryptedRecipientPhone,
        from: relayNumber.phoneNumber,
        body,
      });

      await this.prisma.messageDelivery.create({
        data: {
          messageId: message.id,
          provider: 'mock',
          providerMessageId: sendResult.providerMessageId,
          status: DeliveryStatus.SENT,
          occurredAt: new Date(),
        },
      });

      message = await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.SENT,
          sentAt: new Date(),
          providerMessageId: sendResult.providerMessageId,
          idempotencyKey,
        },
        include: { sender: { include: { profile: true } } },
      });
    }

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        status: conversation.status === ConversationStatus.NEW_INQUIRY && !isSenderTenant
          ? ConversationStatus.ACTIVE
          : undefined,
      },
    });

    return { message: MessageResponseDto.from(message, conversation.tenantId), blocked: false };
  }

  /**
   * Ingests a message that arrived as a real inbound SMS (the "reply
   * directly from your phone" path), already routed to a conversation by
   * SmsRoutingService. Idempotent on providerMessageId so a webhook retried
   * by the carrier never creates a duplicate message.
   */
  async ingestInbound(params: {
    conversationId: string;
    senderId: string;
    body: string;
    providerMessageId: string;
  }): Promise<ComposeResult> {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: params.conversationId },
      include: CONVERSATION_WITH_ROUTING_INCLUDE,
    });

    const existing = await this.prisma.message.findUnique({
      where: { providerMessageId: params.providerMessageId },
      include: { sender: { include: { profile: true } } },
    });
    if (existing) {
      return {
        message: MessageResponseDto.from(existing, conversation.tenantId),
        blocked: existing.status === MessageStatus.BLOCKED,
      };
    }

    if (await this.moderationService.isRestricted(params.senderId)) {
      const relayNumber = conversation.relayAssignments[0]?.relayNumber;
      const senderPhone = await this.prisma.phoneNumber.findFirst({
        where: { userId: params.senderId, isVerified: true, isPrimary: true },
      });
      if (relayNumber && senderPhone) {
        await this.smsProvider.sendMessage({
          to: this.crypto.decrypt(senderPhone.encryptedNumber),
          from: relayNumber.phoneNumber,
          body: 'Your messaging privileges are temporarily restricted due to prior policy violations.',
        });
      }
      throw new ForbiddenException('Sender is temporarily restricted from sending messages');
    }

    const isSenderTenant = params.senderId === conversation.tenantId;
    const recipientId = isSenderTenant ? conversation.landlordId : conversation.tenantId;
    const relayNumber = conversation.relayAssignments[0]?.relayNumber;

    const moderation = this.moderationService.evaluate(params.body);

    if (moderation.blocked) {
      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: params.senderId,
          recipientId,
          direction: MessageDirection.INBOUND,
          channel: MessageChannel.SMS,
          originalContent: params.body,
          sanitizedContent: moderation.sanitizedContent,
          moderationDecision: ModerationDecision.BLOCKED,
          status: MessageStatus.BLOCKED,
          providerMessageId: params.providerMessageId,
        },
        include: { sender: { include: { profile: true } } },
      });

      const worstMatch = [...moderation.matches].sort((a, b) => b.confidenceScore - a.confidenceScore)[0];
      await this.moderationService.recordViolationAndEscalate({
        userId: params.senderId,
        conversationId: conversation.id,
        messageId: message.id,
        content: params.body,
        sanitizedContent: moderation.sanitizedContent,
        match: worstMatch,
      });

      if (relayNumber) {
        const senderPhone = await this.prisma.phoneNumber.findFirst({
          where: { userId: params.senderId, isVerified: true, isPrimary: true },
        });
        if (senderPhone) {
          await this.smsProvider.sendMessage({
            to: this.crypto.decrypt(senderPhone.encryptedNumber),
            from: relayNumber.phoneNumber,
            body: 'Your message was not delivered because it may contain personal contact or off-platform payment information. Please edit the message and continue communicating through the platform.',
          });
        }
      }

      return { message: MessageResponseDto.from(message, conversation.tenantId), blocked: true };
    }

    let message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: params.senderId,
        recipientId,
        direction: MessageDirection.INBOUND,
        channel: MessageChannel.SMS,
        originalContent: params.body,
        sanitizedContent: params.body,
        moderationDecision: ModerationDecision.APPROVED,
        status: MessageStatus.RECEIVED,
        providerMessageId: params.providerMessageId,
      },
      include: { sender: { include: { profile: true } } },
    });

    const recipientPhone = await this.prisma.phoneNumber.findFirst({
      where: { userId: recipientId, isVerified: true, isPrimary: true },
    });

    if (recipientPhone && relayNumber) {
      const body = this.composeNotificationBody({
        recipientIsLandlord: isSenderTenant,
        senderId: params.senderId,
        landlordDisplayName: conversation.landlord.profile?.displayName ?? 'the property manager',
        propertyTitle: conversation.property.title,
        content: params.body,
        isFirstMessage: false,
      });

      const forwardResult = await this.smsProvider.sendMessage({
        to: this.crypto.decrypt(recipientPhone.encryptedNumber),
        from: relayNumber.phoneNumber,
        body,
      });

      await this.prisma.messageDelivery.create({
        data: {
          messageId: message.id,
          provider: 'mock',
          providerMessageId: forwardResult.providerMessageId,
          status: DeliveryStatus.SENT,
          occurredAt: new Date(),
        },
      });

      message = await this.prisma.message.update({
        where: { id: message.id },
        data: { status: MessageStatus.DELIVERED, deliveredAt: new Date() },
        include: { sender: { include: { profile: true } } },
      });
    }

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        status:
          conversation.status === ConversationStatus.NEW_INQUIRY && !isSenderTenant
            ? ConversationStatus.ACTIVE
            : undefined,
      },
    });

    return { message: MessageResponseDto.from(message, conversation.tenantId), blocked: false };
  }

  async listForConversation(actor: AuthenticatedUser, conversationId: string): Promise<MessageResponseDto[]> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant = actor.id === conversation.tenantId || actor.id === conversation.landlordId;
    const isStaff = STAFF_ROLES.includes(actor.role);
    if (!isParticipant && !isStaff) {
      const participant = await this.prisma.conversationParticipant.findFirst({
        where: { conversationId, userId: actor.id, leftAt: null },
      });
      if (!participant) {
        throw new ForbiddenException('You do not have access to this conversation');
      }
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      include: { sender: { include: { profile: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Blocked messages were never forwarded — only their own sender (or
    // staff reviewing the conversation) should ever see the content.
    const visible = messages.filter((m) => m.status !== MessageStatus.BLOCKED || m.senderId === actor.id || isStaff);

    return visible.map((m) => MessageResponseDto.from(m, conversation.tenantId));
  }

  /**
   * Applies a delivery-status webhook event (queued/sent/delivered/failed/
   * undelivered) to the message it refers to. Unmatched provider message
   * IDs are logged and otherwise ignored — the carrier may report on
   * messages this environment never sent (e.g. after a DB restore).
   */
  async recordDeliveryStatus(parsed: { providerMessageId: string; status: string; errorCode?: string; errorMessage?: string }): Promise<void> {
    const message = await this.prisma.message.findUnique({ where: { providerMessageId: parsed.providerMessageId } });
    if (!message) {
      return;
    }

    const normalizedStatus = parsed.status.toLowerCase();
    const deliveryStatus = this.mapToDeliveryStatus(normalizedStatus);

    await this.prisma.messageDelivery.create({
      data: {
        messageId: message.id,
        provider: 'mock',
        providerMessageId: parsed.providerMessageId,
        status: deliveryStatus,
        rawPayload: { status: parsed.status, errorCode: parsed.errorCode ?? null },
        occurredAt: new Date(),
      },
    });

    const messageStatus = this.mapToMessageStatus(normalizedStatus);
    await this.prisma.message.update({
      where: { id: message.id },
      data: {
        status: messageStatus,
        deliveredAt: messageStatus === MessageStatus.DELIVERED ? new Date() : undefined,
        failedAt:
          messageStatus === MessageStatus.FAILED || messageStatus === MessageStatus.UNDELIVERABLE
            ? new Date()
            : undefined,
        errorCode: parsed.errorCode,
        errorMessage: parsed.errorMessage,
      },
    });
  }

  private mapToDeliveryStatus(status: string): DeliveryStatus {
    switch (status) {
      case 'delivered':
        return DeliveryStatus.DELIVERED;
      case 'failed':
        return DeliveryStatus.FAILED;
      case 'undelivered':
        return DeliveryStatus.UNDELIVERABLE;
      case 'sent':
        return DeliveryStatus.SENT;
      default:
        return DeliveryStatus.QUEUED;
    }
  }

  private mapToMessageStatus(status: string): MessageStatus {
    switch (status) {
      case 'delivered':
        return MessageStatus.DELIVERED;
      case 'failed':
        return MessageStatus.FAILED;
      case 'undelivered':
        return MessageStatus.UNDELIVERABLE;
      case 'sent':
        return MessageStatus.SENT;
      default:
        return MessageStatus.QUEUED;
    }
  }

  private composeNotificationBody(params: {
    recipientIsLandlord: boolean;
    senderId: string;
    landlordDisplayName: string;
    propertyTitle: string;
    content: string;
    isFirstMessage: boolean;
  }): string {
    if (params.recipientIsLandlord) {
      const label = `Tenant #${anonymizedNumber(params.senderId)}`;
      if (params.isFirstMessage) {
        return `New inquiry for ${params.propertyTitle} from ${label}:\n${params.content}\nReply directly to this message. Personal contact information cannot be shared through this conversation.`;
      }
      return `Message from ${label} about ${params.propertyTitle}:\n${params.content}`;
    }
    return `Reply from ${params.landlordDisplayName} about ${params.propertyTitle}:\n${params.content}\nPersonal contact information cannot be shared through this conversation.`;
  }
}
