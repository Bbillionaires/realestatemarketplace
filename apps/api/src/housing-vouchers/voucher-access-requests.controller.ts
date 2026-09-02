import { Body, Controller, Get, Param, Patch, Post, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { buildContentDisposition } from '../common/utils/content-disposition.util';
import { VoucherAccessRequestsService } from './voucher-access-requests.service';
import { CreateVoucherAccessRequestDto } from './dto/create-voucher-access-request.dto';

const TENANT_ROLES = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];

@Controller('conversations/:conversationId/voucher-access-requests')
export class VoucherAccessRequestsConversationController {
  constructor(private readonly requestsService: VoucherAccessRequestsService) {}

  @Post()
  @AuditLog('voucher_access_request.create', 'VoucherAccessRequest')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: CreateVoucherAccessRequestDto,
  ) {
    return this.requestsService.createOrRenew(user, conversationId, dto);
  }

  @Get()
  get(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.requestsService.getForConversation(user, conversationId);
  }

  @Get('download')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const doc = await this.requestsService.getDownloadTarget(user, conversationId);
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': buildContentDisposition(doc.fileName, 'attachment'),
    });
    return new StreamableFile(doc.fileData);
  }
}

@Controller('voucher-access-requests')
export class VoucherAccessRequestsController {
  constructor(private readonly requestsService: VoucherAccessRequestsService) {}

  @Get('me')
  @Roles(...TENANT_ROLES)
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.requestsService.listMine(user);
  }

  @Patch(':id/accept')
  @Roles(...TENANT_ROLES)
  @AuditLog('voucher_access_request.accept', 'VoucherAccessRequest')
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.requestsService.accept(user, id);
  }

  @Patch(':id/decline')
  @Roles(...TENANT_ROLES)
  @AuditLog('voucher_access_request.decline', 'VoucherAccessRequest')
  decline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.requestsService.decline(user, id);
  }
}
