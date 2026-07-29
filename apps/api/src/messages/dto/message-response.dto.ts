import { MessageChannel, MessageDirection, MessageStatus, ModerationDecision } from '@prisma/client';
import { anonymizedNumber } from '../../common/utils/anonymized-label.util';

/**
 * A blocked message's `content` is only ever populated for the sender who
 * wrote it (so they can see what to edit) — see MessagesService filtering.
 * It is never the sender's real phone/email that leaks here; the point is
 * the opposite: this DTO never includes anyone's phone number at all.
 *
 * `senderDisplayName` mirrors ConversationResponseDto.tenantDisplayName:
 * whenever the sender is the conversation's tenant, it's always the
 * anonymized "Tenant #1234" label, never their real profile name — the
 * same label used in SMS notifications — so the thread view can never leak
 * the tenant's identity even though the conversation header already hides
 * it. Landlord/manager senders show their real (business) display name.
 */
export class MessageResponseDto {
  id!: string;
  conversationId!: string;
  senderId!: string | null;
  senderDisplayName!: string;
  direction!: MessageDirection;
  channel!: MessageChannel;
  content!: string;
  moderationDecision!: ModerationDecision;
  status!: MessageStatus;
  createdAt!: Date;
  sentAt!: Date | null;
  deliveredAt!: Date | null;

  static from(
    message: {
      id: string;
      conversationId: string;
      senderId: string | null;
      sender?: { profile?: { displayName: string } | null } | null;
      direction: MessageDirection;
      channel: MessageChannel;
      originalContent: string;
      sanitizedContent: string | null;
      moderationDecision: ModerationDecision;
      status: MessageStatus;
      createdAt: Date;
      sentAt: Date | null;
      deliveredAt: Date | null;
    },
    tenantId: string,
  ): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = message.id;
    dto.conversationId = message.conversationId;
    dto.senderId = message.senderId;
    dto.senderDisplayName =
      message.senderId === tenantId
        ? `Tenant #${anonymizedNumber(tenantId)}`
        : message.sender?.profile?.displayName ?? 'Unknown';
    dto.direction = message.direction;
    dto.channel = message.channel;
    dto.content = message.originalContent;
    dto.moderationDecision = message.moderationDecision;
    dto.status = message.status;
    dto.createdAt = message.createdAt;
    dto.sentAt = message.sentAt;
    dto.deliveredAt = message.deliveredAt;
    return dto;
  }
}
