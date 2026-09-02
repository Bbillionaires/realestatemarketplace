import { Controller, Get, Param, Post, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { buildContentDisposition } from '../common/utils/content-disposition.util';
import { VoucherDocumentsService } from './voucher-documents.service';

const STAFF_ROLES = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];

@Controller('voucher-documents')
export class VoucherDocumentsController {
  constructor(private readonly voucherDocumentsService: VoucherDocumentsService) {}

  @Post('me')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @AuditLog('voucher_document.upload', 'VoucherDocument')
  uploadMine(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    return this.voucherDocumentsService.upsertMine(user, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      buffer: file.buffer,
    });
  }

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.voucherDocumentsService.getMineMetadata(user);
  }

  @Get('me/download')
  async downloadMine(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const doc = await this.voucherDocumentsService.getMineFile(user);
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': buildContentDisposition(doc.fileName, 'inline'),
    });
    return new StreamableFile(doc.fileData);
  }

  @Get('admin')
  @Roles(...STAFF_ROLES)
  listAdmin(@CurrentUser() user: AuthenticatedUser) {
    return this.voucherDocumentsService.listForAdmin(user);
  }

  @Get('admin/:tenantId/download')
  @Roles(...STAFF_ROLES)
  async downloadAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId') tenantId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const doc = await this.voucherDocumentsService.getForAdminDownload(user, tenantId);
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': buildContentDisposition(doc.fileName, 'attachment'),
    });
    return new StreamableFile(doc.fileData);
  }
}
