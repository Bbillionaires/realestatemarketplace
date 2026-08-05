import { IsString } from 'class-validator';

export class ClaimGigJobDto {
  /**
   * Which of the tenant's own conversations this claim is tied to. For a
   * landlord/property-manager-posted job this proves eligibility (must be a
   * conversation with that same poster); for an admin-posted job it's how
   * the tenant tells us which landlord relationship the resulting voucher
   * should be earmarked for.
   */
  @IsString()
  conversationId!: string;
}
