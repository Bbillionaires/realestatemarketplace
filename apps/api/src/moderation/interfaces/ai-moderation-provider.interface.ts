export interface AiModerationClassification {
  flagged: boolean;
  category?: string;
  confidence?: number;
}

/**
 * Optional AI fallback layer, only ever consulted after every deterministic
 * rule (regex, normalization, keyword, pattern recognition, history
 * analysis) has already run and found nothing — per the spec, the
 * platform must not rely on an AI model as the primary filter. Swap
 * `NullAiModerationProvider` for a real implementation (calling out to a
 * hosted moderation model) the same way `MockSmsProvider` gets swapped for
 * `TwilioProvider`, via the AI_MODERATION_PROVIDER DI token.
 */
export interface AiModerationProvider {
  classify(content: string): Promise<AiModerationClassification>;
}
