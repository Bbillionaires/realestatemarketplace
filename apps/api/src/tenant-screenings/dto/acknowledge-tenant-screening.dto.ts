import { Equals } from 'class-validator';

export class AcknowledgeTenantScreeningDto {
  @Equals(true)
  acknowledgeHoldHarmless!: boolean;
}
