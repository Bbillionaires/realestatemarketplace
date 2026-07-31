import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinWaitlistDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
