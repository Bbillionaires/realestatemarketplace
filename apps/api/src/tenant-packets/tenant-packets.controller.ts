import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { TenantPacketsService } from './tenant-packets.service';
import { SubmitTenantPacketDto } from './dto/submit-tenant-packet.dto';

@Controller('tenant-packet')
export class TenantPacketsController {
  constructor(private readonly tenantPacketsService: TenantPacketsService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantPacketsService.getOrCreateMine(user);
  }

  @Post('submit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @AuditLog('tenant_packet.submit', 'TenantPacket')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitTenantPacketDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.tenantPacketsService.submit(
      user,
      {
        backgroundExplanation: dto.backgroundExplanation,
        references: dto.references,
        monthlyIncomeCents: dto.monthlyIncomeCents,
        employerName: dto.employerName,
        referenceContacts: dto.referenceContacts,
      },
      file ? { originalname: file.originalname, mimetype: file.mimetype, buffer: file.buffer } : undefined,
    );
  }
}

@Controller('conversations/:conversationId/tenant-packet')
export class TenantPacketShareController {
  constructor(private readonly tenantPacketsService: TenantPacketsService) {}

  @Post('share')
  @AuditLog('tenant_packet.share', 'TenantPacket')
  share(@CurrentUser() user: AuthenticatedUser, @Param('conversationId') conversationId: string) {
    return this.tenantPacketsService.share(user, conversationId);
  }
}
