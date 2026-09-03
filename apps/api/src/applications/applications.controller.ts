import { Body, Controller, Get, Param, Patch, Post, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { buildContentDisposition } from '../common/utils/content-disposition.util';
import { ApplicationsService } from './applications.service';
import { UpdateApplicationDto } from './dto/update-application.dto';

@Controller('conversations/:conversationId/applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @AuditLog('application.create', 'Application')
  create(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.applicationsService.createOrGet(user, conversationId);
  }

  @Get()
  get(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.applicationsService.get(user, conversationId);
  }

  @Patch()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @AuditLog('application.update', 'Application')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: UpdateApplicationDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.applicationsService.update(
      user,
      conversationId,
      dto,
      file ? { originalname: file.originalname, mimetype: file.mimetype, buffer: file.buffer } : undefined,
    );
  }

  @Post('pay')
  @AuditLog('application.pay', 'Application')
  pay(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.applicationsService.pay(user, conversationId);
  }

  @Post('submit')
  @AuditLog('application.submit', 'Application')
  submit(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.applicationsService.submit(user, conversationId);
  }

  @Patch('withdraw')
  @AuditLog('application.withdraw', 'Application')
  withdraw(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.applicationsService.withdraw(user, conversationId);
  }

  @Get('income-proof')
  async downloadIncomeProof(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.applicationsService.getIncomeProof(user, conversationId);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': buildContentDisposition(file.fileName, 'attachment'),
    });
    return new StreamableFile(file.fileData);
  }
}
