import { Module } from '@nestjs/common';
import { HomeownershipMilestonesController } from './homeownership-milestones.controller';
import { HomeownershipMilestonesService } from './homeownership-milestones.service';
import { HomeownershipProgressController } from './homeownership-progress.controller';
import { HomeownershipProgressService } from './homeownership-progress.service';

@Module({
  controllers: [HomeownershipMilestonesController, HomeownershipProgressController],
  providers: [HomeownershipMilestonesService, HomeownershipProgressService],
})
export class HomeownershipModule {}
