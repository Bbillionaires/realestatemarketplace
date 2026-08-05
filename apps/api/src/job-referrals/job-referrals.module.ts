import { Module } from '@nestjs/common';
import { JobReferralsController } from './job-referrals.controller';
import { JobReferralsService } from './job-referrals.service';

@Module({
  controllers: [JobReferralsController],
  providers: [JobReferralsService],
})
export class JobReferralsModule {}
