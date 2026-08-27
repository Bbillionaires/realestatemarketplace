import { Module } from '@nestjs/common';
import { HqsInspectionsController, HqsInspectionActionsController } from './hqs-inspections.controller';
import { HqsInspectionsService } from './hqs-inspections.service';

@Module({
  controllers: [HqsInspectionsController, HqsInspectionActionsController],
  providers: [HqsInspectionsService],
  exports: [HqsInspectionsService],
})
export class HqsInspectionsModule {}
