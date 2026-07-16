import { lastFourDigits, maskPhoneNumber, normalizePhoneNumber } from './phone.util';

describe('phone.util', () => {
  describe('normalizePhoneNumber', () => {
    it('normalizes a US number without country code to E.164', () => {
      expect(normalizePhoneNumber('904-555-1234')).toBe('+19045551234');
    });

    it('normalizes a number already in E.164', () => {
      expect(normalizePhoneNumber('+19045551234')).toBe('+19045551234');
    });

    it('normalizes numbers written with spaces or dots', () => {
      expect(normalizePhoneNumber('904 555 1234')).toBe('+19045551234');
      expect(normalizePhoneNumber('904.555.1234')).toBe('+19045551234');
    });

    it('throws on an invalid phone number', () => {
      expect(() => normalizePhoneNumber('not-a-number')).toThrow();
      expect(() => normalizePhoneNumber('123')).toThrow();
    });
  });

  describe('maskPhoneNumber / lastFourDigits', () => {
    it('exposes only the last 4 digits', () => {
      const e164 = '+19045551234';
      expect(lastFourDigits(e164)).toBe('1234');
      const masked = maskPhoneNumber(e164);
      expect(masked).toContain('1234');
      expect(masked).not.toContain('904555');
      expect(masked).not.toBe(e164);
    });
  });
});
