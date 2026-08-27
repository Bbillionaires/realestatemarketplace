import { IsIn } from 'class-validator';

export class CreateSubscriptionCheckoutDto {
  @IsIn(['PRO', 'UNLIMITED'])
  tier!: 'PRO' | 'UNLIMITED';
}
