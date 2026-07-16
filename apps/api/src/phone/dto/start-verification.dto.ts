import { IsString, MinLength } from 'class-validator';

export class StartVerificationDto {
  @IsString()
  @MinLength(7)
  phoneNumber!: string;
}
