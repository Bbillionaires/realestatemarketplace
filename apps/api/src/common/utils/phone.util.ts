import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normalizes user-supplied phone input to E.164. Throws for anything that
 * doesn't parse as a valid number so malformed/obfuscated input never makes
 * it into storage.
 */
export function normalizePhoneNumber(input: string, defaultCountry: string = 'US'): string {
  const parsed = parsePhoneNumberFromString(input, defaultCountry as never);
  if (!parsed || !parsed.isValid()) {
    throw new BadRequestException('Invalid phone number');
  }
  return parsed.number; // E.164, e.g. +19045551234
}

/** Last 4 digits, used for masked display and human-readable audit context. */
export function lastFourDigits(e164: string): string {
  return e164.slice(-4);
}

/**
 * Renders a masked phone number for authorized dashboard display only, e.g.
 * "+1 (***) ***-1234". Never returns enough information to reconstruct the
 * full number.
 */
export function maskPhoneNumber(e164: string): string {
  const last4 = lastFourDigits(e164);
  return `(***) ***-${last4}`;
}
