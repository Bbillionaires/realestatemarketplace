import { createHash } from 'crypto';

/**
 * Deterministic, non-reversible 4-digit label for a user (e.g. "Tenant
 * #4821") used in SMS notifications during the inquiry stage, per the
 * contact-release rules: the other party sees an anonymous identifier, not
 * a real name, until the platform's release conditions are met.
 */
export function anonymizedNumber(userId: string): string {
  const hash = createHash('sha256').update(userId).digest();
  const value = hash.readUInt16BE(0) % 9000 + 1000;
  return String(value);
}
