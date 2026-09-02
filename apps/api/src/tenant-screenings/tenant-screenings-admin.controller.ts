import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role, TenantScreeningStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { TenantScreeningsService } from './tenant-screenings.service';
import { UploadScreeningResultDto } from './dto/upload-screening-result.dto';

const STAFF_ROLES = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];

@Controller('tenant-screenings/admin')
export class TenantScreeningsAdminController {
  constructor(private readonly tenantScreeningsService: TenantScreeningsService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  list(@Query('status') status?: TenantScreeningStatus) {
    return this.tenantScreeningsService.listForAdmin(status);
  }

  @Patch(':id/mark-submitted')
  @Roles(...STAFF_ROLES)
  @AuditLog('tenant_screening.mark_submitted', 'TenantScreening')
  markSubmitted(@Param('id') id: string) {
    return this.tenantScreeningsService.markSubmittedExternally(id);
  }

  @Post(':id/result')
  @Roles(...STAFF_ROLES)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @AuditLog('tenant_screening.upload_result', 'TenantScreening')
  uploadResult(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UploadScreeningResultDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.tenantScreeningsService.uploadResult(user, id, dto.staffNotes, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      buffer: file.buffer,
    });
  }

  @Patch(':id/cancel')
  @Roles(...STAFF_ROLES)
  @AuditLog('tenant_screening.cancel', 'TenantScreening')
  cancel(@Param('id') id: string) {
    return this.tenantScreeningsService.cancelByAdmin(id);
  }
}
