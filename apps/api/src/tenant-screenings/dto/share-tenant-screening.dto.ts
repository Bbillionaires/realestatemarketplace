import { IsNotEmpty, IsString } from 'class-validator';

export class ShareTenantScreeningDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;
}
