import { Equals, IsEmail } from 'class-validator';

export class RequestTenantScreeningDto {
  @IsEmail()
  tenantEmail!: string;

  @Equals(true)
  acknowledgeHoldHarmless!: boolean;
}
