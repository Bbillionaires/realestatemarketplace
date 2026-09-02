import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPacketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { EMAIL_PROVIDER } from '../email/email.constants';
import { EmailProvider } from '../email/interfaces/email-provider.interface';
import { TenantPacketResponseDto } from './dto/tenant-packet-response.dto';
import { TenantPacketReferenceDto } from './dto/submit-tenant-packet.dto';

const PACKET_INCLUDE = { referenceContacts: true } as const;

const CONVERSATION_INCLUDE = {
  property: { select: { title: true } },
  landlord: { select: { email: true, profile: { select: { displayName: true } } } },
} as const;

export interface UploadedIncomeProof {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class TenantPacketsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  /** Free and open to any registered account — lazily created on first touch, like TenantPacket always has been. */
  private async getOrCreateRow(actor: AuthenticatedUser) {
    return this.prisma.tenantPacket.upsert({
      where: { tenantId: actor.id },
      create: { tenantId: actor.id, feeCents: 0, status: TenantPacketStatus.PAID },
      update: {},
      include: PACKET_INCLUDE,
    });
  }

  async getOrCreateMine(actor: AuthenticatedUser): Promise<TenantPacketResponseDto> {
    const packet = await this.getOrCreateRow(actor);
    return TenantPacketResponseDto.from(packet);
  }

  async submit(
    actor: AuthenticatedUser,
    fields: {
      backgroundExplanation?: string;
      references?: string;
      monthlyIncomeCents?: number;
      employerName?: string;
      referenceContacts?: TenantPacketReferenceDto[];
    },
    file: UploadedIncomeProof | undefined,
  ): Promise<TenantPacketResponseDto> {
    const packet = await this.getOrCreateRow(actor);

    // referenceContacts is full-replace-on-submit (delete + recreate) rather
    // than diffed — low-volume personal data attached to one packet, so this
    // is simpler and safer than reconciling individual rows.
    const [updated] = await this.prisma.$transaction([
      this.prisma.tenantPacket.update({
        where: { id: packet.id },
        data: {
          status: TenantPacketStatus.SUBMITTED,
          backgroundExplanation: fields.backgroundExplanation ?? packet.backgroundExplanation,
          references: fields.references ?? packet.references,
          monthlyIncomeCents: fields.monthlyIncomeCents ?? packet.monthlyIncomeCents,
          employerName: fields.employerName ?? packet.employerName,
          ...(file
            ? { incomeProofFileName: file.originalname, incomeProofMimeType: file.mimetype, incomeProofFile: file.buffer }
            : {}),
          submittedAt: new Date(),
        },
        include: PACKET_INCLUDE,
      }),
      ...(fields.referenceContacts
        ? [
            this.prisma.tenantPacketReference.deleteMany({ where: { tenantPacketId: packet.id } }),
            this.prisma.tenantPacketReference.createMany({
              data: fields.referenceContacts.map((r) => ({ tenantPacketId: packet.id, ...r })),
            }),
          ]
        : []),
    ]);

    // Re-fetch when references changed, since the update above ran before the
    // delete+recreate and its included referenceContacts would be stale.
    const final = fields.referenceContacts
      ? await this.prisma.tenantPacket.findUniqueOrThrow({ where: { id: packet.id }, include: PACKET_INCLUDE })
      : updated;
    return TenantPacketResponseDto.from(final);
  }

  /** Emails the tenant's Fast-Track packet to the landlord-side contact on one conversation. Reusable — the tenant can share the same packet into as many conversations as they want. */
  async share(actor: AuthenticatedUser, conversationId: string): Promise<{ emailed: boolean }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: CONVERSATION_INCLUDE,
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.tenantId !== actor.id) {
      throw new ForbiddenException('Only the tenant on this conversation can share their packet');
    }

    const packet = await this.prisma.tenantPacket.findUnique({ where: { tenantId: actor.id }, include: PACKET_INCLUDE });
    if (!packet || packet.status !== TenantPacketStatus.SUBMITTED) {
      throw new BadRequestException('Fill out and submit your Fast-Track packet before sharing it');
    }
    if (!conversation.landlord.email) {
      throw new BadRequestException('This conversation has no landlord-side contact to email');
    }

    const bodyLines = [
      `Monthly income: ${packet.monthlyIncomeCents != null ? `$${(packet.monthlyIncomeCents / 100).toFixed(2)}` : '(not provided)'}`,
      `Employer: ${packet.employerName ?? '(not provided)'}`,
      `Background: ${packet.backgroundExplanation ?? '(not provided)'}`,
      packet.referenceContacts.length > 0
        ? `References:\n${packet.referenceContacts.map((r) => `  - ${r.name}${r.relationship ? ` (${r.relationship})` : ''}${r.phone ? ` · ${r.phone}` : ''}${r.email ? ` · ${r.email}` : ''}`).join('\n')}`
        : `References: ${packet.references ?? '(not provided)'}`,
    ];
    await this.emailProvider.sendEmail({
      to: conversation.landlord.email,
      subject: `Fast-Track tenant profile — ${conversation.property.title}`,
      text: bodyLines.join('\n\n'),
      attachments:
        packet.incomeProofFile && packet.incomeProofFileName
          ? [{ filename: packet.incomeProofFileName, content: Buffer.from(packet.incomeProofFile), contentType: packet.incomeProofMimeType ?? undefined }]
          : undefined,
    });

    return { emailed: true };
  }
}
