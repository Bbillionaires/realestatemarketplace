import { Body, Controller, Get, Param, Patch, Post, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { buildContentDisposition } from '../common/utils/content-disposition.util';
import { TenantScreeningsService } from './tenant-screenings.service';
import { RequestTenantScreeningDto } from './dto/request-tenant-screening.dto';
import { AcknowledgeTenantScreeningDto } from './dto/acknowledge-tenant-screening.dto';
import { ShareTenantScreeningDto } from './dto/share-tenant-screening.dto';

const INITIATOR_ROLES = [Role.LANDLORD, Role.PROPERTY_MANAGER, Role.EMPLOYER];

@Controller('tenant-screenings')
export class TenantScreeningsController {
  constructor(private readonly tenantScreeningsService: TenantScreeningsService) {}

  @Post()
  @AuditLog('tenant_screening.create', 'TenantScreening')
  create(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantScreeningsService.createMine(user);
  }

  @Post('request')
  @Roles(...INITIATOR_ROLES)
  @AuditLog('tenant_screening.request', 'TenantScreening')
  request(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestTenantScreeningDto) {
    return this.tenantScreeningsService.requestForTenant(user, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantScreeningsService.listMine(user);
  }

  @Post(':id/pay')
  @AuditLog('tenant_screening.pay', 'TenantScreening')
  pay(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tenantScreeningsService.pay(user, id);
  }

  @Patch(':id/decline')
  @AuditLog('tenant_screening.decline', 'TenantScreening')
  decline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tenantScreeningsService.decline(user, id);
  }

  @Post(':id/share')
  @AuditLog('tenant_screening.share', 'TenantScreening')
  share(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ShareTenantScreeningDto) {
    return this.tenantScreeningsService.share(user, id, dto);
  }

  @Get(':id/download')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.tenantScreeningsService.getDownloadTarget(user, id);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': buildContentDisposition(file.fileName, 'attachment'),
    });
    return new StreamableFile(file.fileData);
  }
}

@Controller('conversations/:conversationId/tenant-screenings')
export class TenantScreeningsConversationController {
  constructor(private readonly tenantScreeningsService: TenantScreeningsService) {}

  @Post()
  @AuditLog('tenant_screening.request', 'TenantScreening')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: AcknowledgeTenantScreeningDto,
  ) {
    return this.tenantScreeningsService.createForConversation(user, conversationId, dto);
  }

  @Get()
  get(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.tenantScreeningsService.getForConversation(user, conversationId);
  }

  @Get('download')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.tenantScreeningsService.getDownloadTargetForConversation(user, conversationId);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': buildContentDisposition(file.fileName, 'attachment'),
    });
    return new StreamableFile(file.fileData);
  }
}
