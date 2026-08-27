import { Module } from '@nestjs/common';
import { TenantPacketsController, TenantPacketShareController } from './tenant-packets.controller';
import { TenantPacketsService } from './tenant-packets.service';

@Module({
  controllers: [TenantPacketsController, TenantPacketShareController],
  providers: [TenantPacketsService],
  exports: [TenantPacketsService],
})
export class TenantPacketsModule {}
