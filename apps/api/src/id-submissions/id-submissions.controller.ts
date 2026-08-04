import { Body, Controller, Get, Param, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { IdSubmissionsService } from './id-submissions.service';
import { SubmitIdSubmissionDto } from './dto/submit-id-submission.dto';

@Controller('conversations/:conversationId/id-submissions')
export class IdSubmissionsController {
  constructor(private readonly idSubmissionsService: IdSubmissionsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.idSubmissionsService.listForConversation(user, conversationId);
  }

  @Post()
  @AuditLog('id_submission.create', 'IdSubmission')
  create(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.idSubmissionsService.create(user, conversationId);
  }
}

@Controller('id-submissions')
export class IdSubmissionActionsController {
  constructor(private readonly idSubmissionsService: IdSubmissionsService) {}

  @Patch(':id/cancel')
  @AuditLog('id_submission.cancel', 'IdSubmission')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.idSubmissionsService.cancel(user, id);
  }

  @Post(':id/submit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @AuditLog('id_submission.submit', 'IdSubmission')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitIdSubmissionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.idSubmissionsService.submit(
      user,
      id,
      dto.note,
      file ? { originalname: file.originalname, mimetype: file.mimetype, buffer: file.buffer } : undefined,
    );
  }
}
