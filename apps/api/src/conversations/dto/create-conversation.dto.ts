import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @IsUUID()
  propertyId!: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1600)
  message!: string;
}
