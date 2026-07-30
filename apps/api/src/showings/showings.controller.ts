import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ShowingsService } from './showings.service';
import { ProposeShowingDto } from './dto/propose-showing.dto';

@Controller('conversations/:conversationId/showings')
export class ShowingsController {
  constructor(private readonly showingsService: ShowingsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.showingsService.listForConversation(user, conversationId);
  }

  @Post()
  @AuditLog('showing.propose', 'Showing')
  propose(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: ProposeShowingDto,
  ) {
    return this.showingsService.propose(user, conversationId, dto);
  }

  @Patch(':showingId/slots/:slotId/accept')
  @AuditLog('showing.accept_slot', 'Showing')
  acceptSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Param('showingId') showingId: string,
    @Param('slotId') slotId: string,
  ) {
    return this.showingsService.acceptSlot(user, conversationId, showingId, slotId);
  }

  @Patch(':showingId/cancel')
  @AuditLog('showing.cancel', 'Showing')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Param('showingId') showingId: string,
  ) {
    return this.showingsService.cancel(user, conversationId, showingId);
  }

  @Patch(':showingId/complete')
  @AuditLog('showing.complete', 'Showing')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Param('showingId') showingId: string,
  ) {
    return this.showingsService.complete(user, conversationId, showingId);
  }
}
