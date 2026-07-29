import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/utils/crypto.util';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { SMS_PROVIDER } from './sms.constants';
import { ParsedInboundMessage, SmsProvider } from './interfaces/sms-provider.interface';

const MENU_TTL_SECONDS = 600;

export type RoutingResult =
  | { outcome: 'routed'; conversationId: string; senderUserId: string; body: string; providerMessageId: string }
  | { outcome: 'menu_sent' }
  | { outcome: 'not_found' };

/**
 * Resolves an inbound SMS to the correct conversation. Routing cannot rely
 * on (senderPhone, relayNumber) alone: the same relay number is reused
 * across many conversations, and the same tenant phone can be a party to
 * more than one conversation through the same relay (multiple inquiries to
 * offices sharing a number). When more than one candidate conversation
 * matches, we don't guess — we text back a numbered menu and cache the
 * original message (body + provider id) so that once the sender replies
 * with a valid selection, THAT original message is what gets delivered —
 * the digit reply itself is a routing instruction, not a conversation
 * message, and is never persisted as one.
 */
@Injectable()
export class SmsRoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  async route(parsed: ParsedInboundMessage): Promise<RoutingResult> {
    const menuKey = this.menuKey(parsed.to, parsed.from);
    const pendingMenu = await this.redis.get(menuKey);

    if (pendingMenu) {
      const pending = JSON.parse(pendingMenu) as {
        conversationIds: string[];
        senderUserId: string;
        body: string;
        providerMessageId: string;
      };
      const selection = parseInt(parsed.body.trim(), 10);
      if (Number.isInteger(selection) && selection >= 1 && selection <= pending.conversationIds.length) {
        await this.redis.del(menuKey);
        return {
          outcome: 'routed',
          conversationId: pending.conversationIds[selection - 1],
          senderUserId: pending.senderUserId,
          body: pending.body,
          providerMessageId: pending.providerMessageId,
        };
      }
      // Fall through: not a valid menu reply, re-resolve normally below.
    }

    const relayNumber = await this.prisma.relayNumber.findUnique({ where: { phoneNumber: parsed.to } });
    if (!relayNumber) {
      return { outcome: 'not_found' };
    }

    const phoneHash = this.crypto.hash(parsed.from);
    const senderPhone = await this.prisma.phoneNumber.findFirst({
      where: { numberHash: phoneHash, isVerified: true },
    });
    if (!senderPhone) {
      return { outcome: 'not_found' };
    }

    const candidates = await this.prisma.conversation.findMany({
      where: {
        status: { notIn: [ConversationStatus.CLOSED, ConversationStatus.BLOCKED] },
        OR: [{ tenantId: senderPhone.userId }, { landlordId: senderPhone.userId }],
        relayAssignments: { some: { relayNumberId: relayNumber.id, releasedAt: null } },
      },
      include: { property: { select: { title: true } } },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (candidates.length === 0) {
      return { outcome: 'not_found' };
    }

    if (candidates.length === 1) {
      return {
        outcome: 'routed',
        conversationId: candidates[0].id,
        senderUserId: senderPhone.userId,
        body: parsed.body,
        providerMessageId: parsed.providerMessageId,
      };
    }

    await this.redis.set(
      menuKey,
      JSON.stringify({
        conversationIds: candidates.map((c) => c.id),
        senderUserId: senderPhone.userId,
        body: parsed.body,
        providerMessageId: parsed.providerMessageId,
      }),
      'EX',
      MENU_TTL_SECONDS,
    );

    const menuLines = candidates.map((c, i) => `${i + 1}. ${c.property.title}`).join('\n');
    await this.smsProvider.sendMessage({
      to: parsed.from,
      from: parsed.to,
      body: `Which property are you messaging about?\n${menuLines}\nReply with the number.`,
    });

    return { outcome: 'menu_sent' };
  }

  private menuKey(relayNumber: string, senderPhone: string): string {
    return `sms:menu:${relayNumber}:${this.crypto.hash(senderPhone)}`;
  }
}
