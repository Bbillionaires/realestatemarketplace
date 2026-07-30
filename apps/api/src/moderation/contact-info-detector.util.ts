import { DetectionMethod, ViolationType } from '@prisma/client';

export interface ContactInfoMatch {
  violationType: ViolationType;
  detectionMethod: DetectionMethod;
  confidenceScore: number;
  snippet: string;
}

export interface ModerationResult {
  blocked: boolean;
  sanitizedContent: string;
  matches: ContactInfoMatch[];
}

// Matches US-style 10-digit phone numbers in common separator formats:
// 904-555-1234, 904.555.1234, 904 555 1234, (904) 555-1234, +1 904 555 1234.
// Deliberately requires a 10-digit shape (not just any digit run) so rent
// amounts, ZIP codes, and unit numbers are never caught.
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;

// A bare, unpunctuated 10 (or 11 with leading 1) digit run — "9045551234"
// typed with no separators at all is just as much a phone number as the
// hyphenated form; a random 10-digit run otherwise showing up in ordinary
// rental chat (rent amounts, dates, unit numbers) is vanishingly rare.
const CONTIGUOUS_PHONE_REGEX = /\b1?\d{10}\b/g;

const EMAIL_REGEX = /\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b/g;

const URL_REGEX = /\b((https?:\/\/)|(www\.))\S+\b|\b[\w-]+\.(com|net|org|io|co)\b/gi;

const SOCIAL_MEDIA_KEYWORDS = [
  'instagram',
  'facebook',
  'snapchat',
  'tiktok',
  'whatsapp',
  'telegram',
  'discord',
  'signal',
  'twitter',
  'ig handle',
  'my handle',
];

const PAYMENT_KEYWORDS = ['cashapp', 'cash app', 'venmo', 'paypal', 'zelle'];

const OFF_PLATFORM_PHRASES = [
  'call me',
  'text me',
  'email me',
  'reach me at',
  'contact me at',
  'contact me outside',
  'off the app',
  'off platform',
  'find me on',
  'message me on the app with',
  'my number is',
  'my email is',
];

const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};
const NUMBER_WORD_PATTERN = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\b`, 'g');

function normalizeAtDot(content: string): string {
  return content
    .toLowerCase()
    .replace(/\bat\b/g, '@')
    .replace(/\bdot\b/g, '.')
    .replace(/\s*@\s*/g, '@')
    .replace(/\s*\.\s*/g, '.')
    .replace(/[^\S\r\n]+/g, ' ');
}

/** "nine zero four five five five one two three four" -> "9 0 4 5 5 5 1 2 3 4" */
function wordsToDigits(content: string): string {
  return content.toLowerCase().replace(NUMBER_WORD_PATTERN, (word) => NUMBER_WORDS[word]);
}

/**
 * Fixes common letter/number lookalike substitutions ("9O4" -> "904",
 * "5O5-l234" -> "505-1234") — but only inside tokens that already contain a
 * real digit, so ordinary words like "lol" or "cool" (all letters, no
 * digits) are never touched.
 */
function substituteLookalikes(content: string): string {
  return content.replace(/\b[\dOolI]{2,4}\b/g, (token) => {
    if (!/\d/.test(token)) return token;
    return token.replace(/[Oo]/g, '0').replace(/[IlI]/g, '1');
  });
}

/** Collapses digit groups separated only by whitespace/dots/dashes into a contiguous run, so spelled-out or letter-substituted numbers can be matched as a single phone number. */
function collapseDigitSeparators(content: string): string {
  let previous: string;
  let current = content;
  do {
    previous = current;
    current = current.replace(/(\d)[\s.-]+(?=\d)/g, '$1');
  } while (current !== previous);
  return current;
}

function findKeywordMatches(
  content: string,
  keywords: string[],
  violationType: ViolationType,
  confidenceScore: number,
): ContactInfoMatch[] {
  const lower = content.toLowerCase();
  const matches: ContactInfoMatch[] = [];
  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      matches.push({ violationType, detectionMethod: DetectionMethod.KEYWORD, confidenceScore, snippet: keyword });
    }
  }
  return matches;
}

/**
 * Deterministic, rule-based contact-info detector. Layers, in order:
 *   1. Regex over the raw text (grouped and bare-digit phone formats, email, URL)
 *   2. "at"/"dot" wording normalization (catches "john at gmail dot com")
 *   3. Full normalization: word-to-digit conversion ("nine zero four" -> "904"),
 *      letter/number lookalike substitution ("9O4" -> "904"), and collapsing
 *      whitespace-only gaps between digit groups, so disguised phone numbers
 *      are matched even when spelled out or lightly obfuscated.
 *   4. Keyword rules for social/payment handles and off-platform requests.
 * Message-history analysis (split-across-messages detection) and an
 * optional AI fallback layer on top of this in ModerationService, since
 * they need conversation context this pure function doesn't have.
 *
 * Every inbound/outbound message runs through here before it is ever
 * forwarded — nothing is delivered while `blocked` is true.
 */
export function detectContactInfo(content: string): ModerationResult {
  const matches: ContactInfoMatch[] = [];
  let sanitizedContent = content;

  const phoneMatches = content.match(PHONE_REGEX) ?? [];
  for (const m of phoneMatches) {
    matches.push({ violationType: ViolationType.PHONE_NUMBER, detectionMethod: DetectionMethod.REGEX, confidenceScore: 0.95, snippet: m });
  }

  const contiguousPhoneMatches = content.match(CONTIGUOUS_PHONE_REGEX) ?? [];
  for (const m of contiguousPhoneMatches) {
    if (!phoneMatches.some((p) => p.replace(/\D/g, '') === m.replace(/\D/g, ''))) {
      matches.push({ violationType: ViolationType.PHONE_NUMBER, detectionMethod: DetectionMethod.REGEX, confidenceScore: 0.9, snippet: m });
    }
  }

  const emailMatches = content.match(EMAIL_REGEX) ?? [];
  for (const m of emailMatches) {
    matches.push({ violationType: ViolationType.EMAIL, detectionMethod: DetectionMethod.REGEX, confidenceScore: 0.95, snippet: m });
  }

  const urlMatches = content.match(URL_REGEX) ?? [];
  for (const m of urlMatches) {
    matches.push({ violationType: ViolationType.URL, detectionMethod: DetectionMethod.REGEX, confidenceScore: 0.9, snippet: m });
  }

  // "at"/"dot" wording normalization — catches "john at gmail dot com".
  const atDotNormalized = normalizeAtDot(content);
  if (atDotNormalized !== content.toLowerCase()) {
    const normalizedEmailMatches = atDotNormalized.match(EMAIL_REGEX) ?? [];
    for (const m of normalizedEmailMatches) {
      if (!emailMatches.some((existing) => existing.toLowerCase() === m)) {
        matches.push({ violationType: ViolationType.EMAIL, detectionMethod: DetectionMethod.NORMALIZATION, confidenceScore: 0.85, snippet: m });
      }
    }
  }

  // Full normalization pass for disguised phone numbers: spelled-out digits
  // ("nine zero four..."), letter lookalikes ("9O4"), and whitespace-only
  // gaps between digit groups, all collapsed into a matchable run.
  const fullyNormalized = collapseDigitSeparators(substituteLookalikes(wordsToDigits(content)));
  if (fullyNormalized !== content.toLowerCase().replace(/\s+/g, ' ')) {
    const normalizedPhoneMatches = [
      ...(fullyNormalized.match(PHONE_REGEX) ?? []),
      ...(fullyNormalized.match(CONTIGUOUS_PHONE_REGEX) ?? []),
    ];
    for (const m of normalizedPhoneMatches) {
      const digits = m.replace(/\D/g, '');
      const alreadyFound = [...phoneMatches, ...contiguousPhoneMatches].some((p) => p.replace(/\D/g, '') === digits);
      if (!alreadyFound) {
        matches.push({
          violationType: ViolationType.PHONE_NUMBER,
          detectionMethod: DetectionMethod.NORMALIZATION,
          confidenceScore: 0.75,
          // The original disguised text never appears verbatim in the
          // message, so there's nothing literal to redact for this match —
          // sanitization for these relies on the overall block, not a
          // find-and-replace snippet.
          snippet: '',
        });
      }
    }
  }

  matches.push(...findKeywordMatches(content, SOCIAL_MEDIA_KEYWORDS, ViolationType.SOCIAL_MEDIA, 0.7));
  matches.push(...findKeywordMatches(content, PAYMENT_KEYWORDS, ViolationType.PAYMENT_HANDLE, 0.75));
  matches.push(...findKeywordMatches(content, OFF_PLATFORM_PHRASES, ViolationType.OFF_PLATFORM_REQUEST, 0.6));

  for (const match of matches) {
    if (match.snippet) {
      sanitizedContent = sanitizedContent.split(match.snippet).join('[removed]');
    }
  }
  // A disguised match with no literal snippet to redact still means the
  // message as a whole must not be forwarded as typed.
  if (matches.some((m) => !m.snippet)) {
    sanitizedContent = '[message withheld: possible disguised contact information]';
  }

  return {
    blocked: matches.length > 0,
    sanitizedContent,
    matches,
  };
}
