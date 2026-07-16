import { IsString, Length, MinLength } from 'class-validator';

export class ConfirmVerificationDto {
  @IsString()
  @MinLength(7)
  phoneNumber!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
