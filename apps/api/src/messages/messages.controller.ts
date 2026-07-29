import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.messagesService.listForConversation(user, conversationId);
  }

  @Post()
  @AuditLog('message.send', 'Message')
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    const result = await this.messagesService.compose({
      conversationId,
      senderId: user.id,
      content: dto.content,
    });
    return {
      message: result.message,
      delivered: !result.blocked,
      guidance: result.blocked
        ? 'Your message was not delivered because it may contain personal contact or off-platform payment information. Please edit the message and continue communicating through the platform.'
        : undefined,
    };
  }
}
