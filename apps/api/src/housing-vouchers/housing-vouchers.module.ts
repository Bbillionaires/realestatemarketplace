import { Module } from '@nestjs/common';
import { VoucherDocumentsController } from './voucher-documents.controller';
import { VoucherDocumentsService } from './voucher-documents.service';
import { VoucherAccessRequestsConversationController, VoucherAccessRequestsController } from './voucher-access-requests.controller';
import { VoucherAccessRequestsService } from './voucher-access-requests.service';

@Module({
  controllers: [VoucherDocumentsController, VoucherAccessRequestsConversationController, VoucherAccessRequestsController],
  providers: [VoucherDocumentsService, VoucherAccessRequestsService],
})
export class HousingVouchersModule {}
