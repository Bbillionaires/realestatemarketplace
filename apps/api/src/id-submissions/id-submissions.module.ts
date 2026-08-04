import { Module } from '@nestjs/common';
import { IdSubmissionsController, IdSubmissionActionsController } from './id-submissions.controller';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { IdSubmissionsService } from './id-submissions.service';

@Module({
  controllers: [IdSubmissionsController, IdSubmissionActionsController, PaymentWebhooksController],
  providers: [IdSubmissionsService],
})
export class IdSubmissionsModule {}
