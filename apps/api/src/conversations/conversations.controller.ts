import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @AuditLog('conversation.start', 'Conversation')
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConversationDto) {
    return this.conversationsService.startConversation(user, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('propertyId') propertyId?: string,
    @Query('status') status?: ConversationStatus,
  ) {
    return this.conversationsService.findAllForActor(user, { propertyId, status });
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conversationsService.findOneForActor(user, id);
  }
}
