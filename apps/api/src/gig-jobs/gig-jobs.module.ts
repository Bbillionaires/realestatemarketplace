import { Module } from '@nestjs/common';
import { GigJobsController, GigVouchersController } from './gig-jobs.controller';
import { GigJobsService } from './gig-jobs.service';

@Module({
  controllers: [GigJobsController, GigVouchersController],
  providers: [GigJobsService],
  exports: [GigJobsService],
})
export class GigJobsModule {}
