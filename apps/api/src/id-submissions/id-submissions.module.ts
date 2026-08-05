import { Module } from '@nestjs/common';
import { GigJobsModule } from '../gig-jobs/gig-jobs.module';
import { IdSubmissionsController, IdSubmissionActionsController } from './id-submissions.controller';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { IdSubmissionsService } from './id-submissions.service';

@Module({
  imports: [GigJobsModule],
  controllers: [IdSubmissionsController, IdSubmissionActionsController, PaymentWebhooksController],
  providers: [IdSubmissionsService],
})
export class IdSubmissionsModule {}
