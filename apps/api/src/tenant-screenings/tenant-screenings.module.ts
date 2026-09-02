import { Module } from '@nestjs/common';
import { TenantScreeningsController, TenantScreeningsConversationController } from './tenant-screenings.controller';
import { TenantScreeningsAdminController } from './tenant-screenings-admin.controller';
import { TenantScreeningsService } from './tenant-screenings.service';

@Module({
  controllers: [TenantScreeningsController, TenantScreeningsConversationController, TenantScreeningsAdminController],
  providers: [TenantScreeningsService],
  exports: [TenantScreeningsService],
})
export class TenantScreeningsModule {}
