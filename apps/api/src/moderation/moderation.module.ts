import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { ModerationAdminService } from './moderation-admin.service';
import { ModerationAdminController } from './moderation-admin.controller';
import { AI_MODERATION_PROVIDER } from './moderation.constants';
import { NullAiModerationProvider } from './providers/null-ai-moderation.provider';

@Module({
  controllers: [ModerationAdminController],
  providers: [
    ModerationService,
    ModerationAdminService,
    { provide: AI_MODERATION_PROVIDER, useClass: NullAiModerationProvider },
  ],
  exports: [ModerationService],
})
export class ModerationModule {}
