/**
 * Minimal duration parser for strings like "15m", "30d", "12h", "45s" to
 * avoid pulling in an extra dependency just for JWT TTL math.
 */
const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const [, amount, unit] = match;
  return parseInt(amount, 10) * UNIT_MS[unit];
}
