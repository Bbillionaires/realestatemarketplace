import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsDecisionController } from './applications-decision.controller';
import { ApplicationsService } from './applications.service';

@Module({
  controllers: [ApplicationsController, ApplicationsDecisionController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
