import { Module } from '@nestjs/common';
import { GigJobsModule } from '../gig-jobs/gig-jobs.module';
import { JobReferralsModule } from '../job-referrals/job-referrals.module';
import { PropertiesModule } from '../properties/properties.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { IdSubmissionsController, IdSubmissionActionsController } from './id-submissions.controller';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { IdSubmissionsService } from './id-submissions.service';

@Module({
  imports: [GigJobsModule, JobReferralsModule, PropertiesModule, SubscriptionsModule],
  controllers: [IdSubmissionsController, IdSubmissionActionsController, PaymentWebhooksController],
  providers: [IdSubmissionsService],
})
export class IdSubmissionsModule {}
