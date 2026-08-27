import { SubscriptionTier } from '@prisma/client';

export class SubscriptionResponseDto {
  tier!: SubscriptionTier;
  expiresAt!: Date | null;
  /** True when `tier` is a paid tier and `expiresAt` hasn't passed yet. */
  isActive!: boolean;
  pendingTier!: SubscriptionTier | null;
  checkoutUrl!: string | null;

  static from(sub: {
    tier: SubscriptionTier;
    expiresAt: Date | null;
    pendingTier: SubscriptionTier | null;
    checkoutUrl: string | null;
  }): SubscriptionResponseDto {
    const dto = new SubscriptionResponseDto();
    dto.tier = sub.tier;
    dto.expiresAt = sub.expiresAt;
    dto.isActive = sub.tier !== 'FREE' && sub.expiresAt !== null && sub.expiresAt.getTime() > Date.now();
    dto.pendingTier = sub.pendingTier;
    dto.checkoutUrl = sub.checkoutUrl;
    return dto;
  }
}
