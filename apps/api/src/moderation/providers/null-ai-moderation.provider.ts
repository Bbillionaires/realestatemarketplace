import { Injectable } from '@nestjs/common';
import { AiModerationClassification, AiModerationProvider } from '../interfaces/ai-moderation-provider.interface';

/**
 * Default AI fallback: always reports "not flagged". This environment has
 * no AI moderation API key/provider configured, so the fallback layer is
 * wired up (and exercised in the pipeline) without ever making an external
 * call. A real provider can be bound to AI_MODERATION_PROVIDER later
 * without any caller needing to change.
 */
@Injectable()
export class NullAiModerationProvider implements AiModerationProvider {
  async classify(_content: string): Promise<AiModerationClassification> {
    return { flagged: false };
  }
}
