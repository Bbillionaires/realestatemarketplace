import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ModerationStatus, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ModerationAdminService } from './moderation-admin.service';
import { ReviewFlagDto } from './dto/review-flag.dto';
import { ImposeRestrictionDto } from './dto/impose-restriction.dto';
import { AddAdminNoteDto } from './dto/add-admin-note.dto';

const STAFF_ROLES = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];

@Controller('moderation')
@Roles(...STAFF_ROLES)
export class ModerationAdminController {
  constructor(private readonly moderationAdminService: ModerationAdminService) {}

  @Get('flags')
  listFlags(@Query('status') status?: ModerationStatus) {
    return this.moderationAdminService.listFlags(status);
  }

  @Get('flags/:id')
  getFlag(@Param('id') id: string) {
    return this.moderationAdminService.getFlag(id);
  }

  @Patch('flags/:id/review')
  reviewFlag(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewFlagDto) {
    return this.moderationAdminService.reviewFlag(actor, id, dto);
  }

  @Get('users/:userId/violations')
  listViolations(@Param('userId') userId: string) {
    return this.moderationAdminService.listViolationsForUser(userId);
  }

  @Get('users/:userId/restrictions')
  listRestrictions(@Param('userId') userId: string) {
    return this.moderationAdminService.listRestrictionsForUser(userId);
  }

  @Post('users/:userId/restrictions')
  imposeRestriction(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: ImposeRestrictionDto,
  ) {
    return this.moderationAdminService.imposeRestriction(actor, userId, dto);
  }

  @Post('restrictions/:id/lift')
  liftRestriction(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.moderationAdminService.liftRestriction(actor, id);
  }

  @Get('conversations/:conversationId/notes')
  listNotes(@Param('conversationId') conversationId: string) {
    return this.moderationAdminService.listNotesForConversation(conversationId);
  }

  @Post('conversations/:conversationId/notes')
  addNote(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: AddAdminNoteDto,
  ) {
    return this.moderationAdminService.addNoteToConversation(actor, conversationId, dto.note);
  }
}
