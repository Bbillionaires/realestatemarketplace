import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, TenantPacketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { EMAIL_PROVIDER } from '../email/email.constants';
import { EmailProvider } from '../email/interfaces/email-provider.interface';
import { PAYMENT_PROVIDER } from '../payments/payments.constants';
import { PaymentProvider } from '../payments/interfaces/payment-provider.interface';
import { TenantPacketResponseDto } from './dto/tenant-packet-response.dto';
import { TenantPacketReferenceDto } from './dto/submit-tenant-packet.dto';

const PACKET_INCLUDE = { referenceContacts: true } as const;

const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const PAID_STATUSES: TenantPacketStatus[] = [TenantPacketStatus.PAID, TenantPacketStatus.SUBMITTED];

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
    private readonly configService: ConfigService<AppConfig>,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  private assertTenant(actor: AuthenticatedUser): void {
    if (actor.role !== Role.PROSPECTIVE_TENANT && actor.role !== Role.CURRENT_TENANT) {
      throw new ForbiddenException('Only tenants have a Fast-Track packet');
    }
  }

  private feeCents(): number {
    return this.configService.get('tenantPacketFeeCents', { infer: true }) as number;
  }

  async getOrCreateMine(actor: AuthenticatedUser): Promise<TenantPacketResponseDto> {
    this.assertTenant(actor);
    const packet = await this.prisma.tenantPacket.findUnique({ where: { tenantId: actor.id }, include: PACKET_INCLUDE });
    return packet ? TenantPacketResponseDto.from(packet) : TenantPacketResponseDto.notStarted(this.feeCents());
  }

  async createCheckout(actor: AuthenticatedUser): Promise<TenantPacketResponseDto> {
    this.assertTenant(actor);
    const feeCents = this.feeCents();

    let packet = await this.prisma.tenantPacket.findUnique({ where: { tenantId: actor.id } });
    if (packet && PAID_STATUSES.includes(packet.status)) {
      throw new BadRequestException('The Fast-Track packet fee has already been paid — no need to pay again');
    }
    if (packet && packet.status === TenantPacketStatus.AWAITING_PAYMENT && packet.checkoutUrl) {
      return TenantPacketResponseDto.from(packet);
    }
    if (!packet) {
      packet = await this.prisma.tenantPacket.create({
        data: { tenantId: actor.id, feeCents, status: TenantPacketStatus.AWAITING_PAYMENT },
      });
    }

    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    const checkout = await this.paymentProvider.createCheckout({
      amountCents: feeCents,
      description: 'Fast-Track tenant profile packet',
      referenceId: packet.id,
      redirectUrl: `${dashboardBaseUrl}/tenant-packet?paid=1`,
    });

    const updated = await this.prisma.tenantPacket.update({
      where: { id: packet.id },
      data: {
        status: TenantPacketStatus.AWAITING_PAYMENT,
        paymentProviderCheckoutId: checkout.providerCheckoutId,
        paymentOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
      },
    });
    return TenantPacketResponseDto.from(updated);
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
    this.assertTenant(actor);
    const packet = await this.prisma.tenantPacket.findUnique({ where: { tenantId: actor.id } });
    if (!packet || !PAID_STATUSES.includes(packet.status)) {
      throw new BadRequestException('The Fast-Track packet fee must be paid before filling it out');
    }

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
    this.assertTenant(actor);
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

  async handlePaymentWebhook(signature: string, url: string, rawBody: string): Promise<void> {
    const valid = this.paymentProvider.validateWebhook({ signature, url, rawBody });
    if (!valid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = this.paymentProvider.parseWebhookEvent(rawBody);
    if (!event || !event.paid) {
      return;
    }

    const packet = await this.prisma.tenantPacket.findFirst({
      where: { paymentOrderId: event.providerOrderId, status: TenantPacketStatus.AWAITING_PAYMENT },
    });
    if (!packet) {
      return;
    }

    await this.prisma.tenantPacket.update({
      where: { id: packet.id },
      data: { status: TenantPacketStatus.PAID, paidAt: new Date() },
    });
  }
}
