import {
  ApplicationStatus,
  ConversationStatus,
  LeaseStatus,
  ModerationStatus,
} from '@prisma/client';
import { anonymizedNumber } from '../../common/utils/anonymized-label.util';

/**
 * Never includes a real phone number — only the relay number (which is a
 * platform-owned number, safe to display) and display names. Tenant and
 * landlord never see each other's actual contact information here.
 *
 * `tenantDisplayName` is always the anonymized "Tenant #1234" label (the
 * same one used in SMS notifications), never the tenant's real profile
 * name — per the default contact-release rule, the tenant's identity stays
 * anonymous through inquiry/showing/application, and only a Phase 4
 * contact-release event (e.g. a signed lease) would change that.
 * `landlordDisplayName` is the landlord/property manager's business display
 * name, which is not personal contact information and is shown as-is.
 *
 * `hasUnread` is a simple heuristic (last non-blocked message wasn't sent
 * by the viewer) rather than true per-user read receipts — there is no
 * "last read at" tracking yet, so this is a "did the other side speak
 * last" signal, not an exact unread count.
 */
export class ConversationResponseDto {
  id!: string;
  property!: { id: string; title: string; addressLine1: string; city: string; state: string };
  unitId!: string | null;
  unitLabel!: string | null;
  tenantDisplayName!: string;
  landlordDisplayName!: string;
  relayPhoneNumber!: string | null;
  status!: ConversationStatus;
  applicationStatus!: ApplicationStatus;
  leaseStatus!: LeaseStatus;
  moderationStatus!: ModerationStatus;
  createdAt!: Date;
  lastMessageAt!: Date | null;
  lastMessagePreview!: string | null;
  hasUnread!: boolean;

  static from(
    conversation: {
      id: string;
      tenantId: string;
      unitId: string | null;
      unit?: { unitLabel: string } | null;
      status: ConversationStatus;
      applicationStatus: ApplicationStatus;
      leaseStatus: LeaseStatus;
      moderationStatus: ModerationStatus;
      createdAt: Date;
      lastMessageAt: Date | null;
      property: { id: string; title: string; addressLine1: string; city: string; state: string };
      landlord: { profile?: { displayName: string } | null };
      relayAssignments?: { relayNumber: { phoneNumber: string }; releasedAt: Date | null }[];
      messages?: { senderId: string | null; originalContent: string }[];
    },
    actorId?: string,
  ): ConversationResponseDto {
    const dto = new ConversationResponseDto();
    dto.id = conversation.id;
    dto.property = conversation.property;
    dto.unitId = conversation.unitId;
    dto.unitLabel = conversation.unit?.unitLabel ?? null;
    dto.tenantDisplayName = `Tenant #${anonymizedNumber(conversation.tenantId)}`;
    dto.landlordDisplayName = conversation.landlord.profile?.displayName ?? 'Property Management';
    const activeAssignment = (conversation.relayAssignments ?? []).find((a) => !a.releasedAt);
    dto.relayPhoneNumber = activeAssignment?.relayNumber.phoneNumber ?? null;
    dto.status = conversation.status;
    dto.applicationStatus = conversation.applicationStatus;
    dto.leaseStatus = conversation.leaseStatus;
    dto.moderationStatus = conversation.moderationStatus;
    dto.createdAt = conversation.createdAt;
    dto.lastMessageAt = conversation.lastMessageAt;

    const lastMessage = conversation.messages?.[0];
    dto.lastMessagePreview = lastMessage?.originalContent ?? null;
    dto.hasUnread = !!lastMessage && !!actorId && lastMessage.senderId !== actorId;

    return dto;
  }
}
