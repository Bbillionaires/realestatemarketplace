import { ViolationType } from '@prisma/client';
import { detectContactInfo } from './contact-info-detector.util';

describe('detectContactInfo', () => {
  it('allows ordinary rent/availability/scheduling messages through', () => {
    const safe = [
      'The monthly rent is $1,850 and the deposit is $1,850.',
      'The unit is available starting September 1st for up to 4 occupants.',
      'We allow one cat with a pet deposit; no additional utilities included.',
      'Would 2pm on Saturday work for a tour of the property at 123 Main Street?',
      'Applicants need a credit score above 620 and income of 3x the rent.',
      'The ZIP code is 32202 and the unit number is 4B.',
    ];
    for (const message of safe) {
      const result = detectContactInfo(message);
      expect(result.blocked).toBe(false);
    }
  });

  it.each([
    ['904-555-1234', 'plain hyphenated'],
    ['904.555.1234', 'dotted'],
    ['904 555 1234', 'spaced'],
    ['(904) 555-1234', 'parenthesized area code'],
    ['+1 904-555-1234', 'with country code'],
  ])('blocks a phone number in %s format (%s)', (phone) => {
    const result = detectContactInfo(`Call me at ${phone} to talk more.`);
    expect(result.blocked).toBe(true);
    expect(result.matches.some((m) => m.violationType === ViolationType.PHONE_NUMBER)).toBe(true);
    expect(result.sanitizedContent).not.toContain(phone);
  });

  it('blocks a plain email address', () => {
    const result = detectContactInfo('Reach out to me at john.smith@gmail.com anytime.');
    expect(result.blocked).toBe(true);
    expect(result.matches.some((m) => m.violationType === ViolationType.EMAIL)).toBe(true);
  });

  it('blocks an email disguised with "at"/"dot" wording', () => {
    const result = detectContactInfo('email me john at gmail dot com please');
    expect(result.blocked).toBe(true);
    expect(result.matches.some((m) => m.violationType === ViolationType.EMAIL)).toBe(true);
  });

  it('blocks a bare URL or domain mention', () => {
    const result = detectContactInfo('Check out my-listing-site.com for more photos');
    expect(result.blocked).toBe(true);
    expect(result.matches.some((m) => m.violationType === ViolationType.URL)).toBe(true);
  });

  it('blocks social media handle requests', () => {
    const result = detectContactInfo('find me on Instagram instead of here');
    expect(result.blocked).toBe(true);
    expect(result.matches.some((m) => m.violationType === ViolationType.SOCIAL_MEDIA)).toBe(true);
  });

  it('blocks payment-app handle mentions', () => {
    const result = detectContactInfo('just send the deposit to my Venmo');
    expect(result.blocked).toBe(true);
    expect(result.matches.some((m) => m.violationType === ViolationType.PAYMENT_HANDLE)).toBe(true);
  });

  it('blocks generic off-platform requests', () => {
    const result = detectContactInfo('please text me instead of using this app');
    expect(result.blocked).toBe(true);
    expect(result.matches.some((m) => m.violationType === ViolationType.OFF_PLATFORM_REQUEST)).toBe(true);
  });

  it('never lets the original contact info survive in the sanitized copy', () => {
    const result = detectContactInfo('you can reach me at 904-555-1234 or jane@example.com');
    expect(result.sanitizedContent).not.toContain('904-555-1234');
    expect(result.sanitizedContent).not.toContain('jane@example.com');
  });

  describe('Phase 3: full normalization', () => {
    it('blocks a phone number spelled out in words', () => {
      const result = detectContactInfo('my number is nine zero four five five five one two three four');
      expect(result.blocked).toBe(true);
      expect(result.matches.some((m) => m.violationType === ViolationType.PHONE_NUMBER)).toBe(true);
    });

    it('blocks a phone number disguised with letter/number lookalikes ("O" for 0)', () => {
      const result = detectContactInfo('reach me at 9O4-555-1234 anytime');
      expect(result.blocked).toBe(true);
      expect(result.matches.some((m) => m.violationType === ViolationType.PHONE_NUMBER)).toBe(true);
    });

    it('blocks a bare, unpunctuated 10-digit phone number', () => {
      const result = detectContactInfo('you can text 9045551234 whenever');
      expect(result.blocked).toBe(true);
      expect(result.matches.some((m) => m.violationType === ViolationType.PHONE_NUMBER)).toBe(true);
    });

    it('does not flag ordinary counts/measurements as disguised phone numbers', () => {
      const safe = [
        'It is a 3 bedroom 2 bathroom home with 2 parking spots.',
        'I have four kids and two dogs, is that a problem for the lease?',
        'Rent is due on the 1st, and the unit sleeps up to 4 occupants.',
        'The property is 2100 square feet with a two car garage.',
      ];
      for (const message of safe) {
        expect(detectContactInfo(message).blocked).toBe(false);
      }
    });

    it('does not mistake casual words like "lol" or "cool" for lookalike digits', () => {
      const result = detectContactInfo('lol that sounds cool, what time works?');
      expect(result.blocked).toBe(false);
    });
  });
});
