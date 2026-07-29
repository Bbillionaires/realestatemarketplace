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
const PHONE_REGEX =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;

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

function normalize(content: string): string {
  return content
    .toLowerCase()
    .replace(/\bat\b/g, '@')
    .replace(/\bdot\b/g, '.')
    .replace(/\s*@\s*/g, '@')
    .replace(/\s*\.\s*/g, '.')
    .replace(/[^\S\r\n]+/g, ' ');
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
 * Deterministic, rule-based contact-info detector. This is the Phase 2
 * minimal gate (regex + a simple "at"/"dot" normalization pass); Phase 3
 * layers on top of this same function with full normalization
 * (word-to-digit conversion, letter/number substitution), pattern
 * recognition, message-history analysis, and an optional AI fallback.
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

  const emailMatches = content.match(EMAIL_REGEX) ?? [];
  for (const m of emailMatches) {
    matches.push({ violationType: ViolationType.EMAIL, detectionMethod: DetectionMethod.REGEX, confidenceScore: 0.95, snippet: m });
  }

  const urlMatches = content.match(URL_REGEX) ?? [];
  for (const m of urlMatches) {
    matches.push({ violationType: ViolationType.URL, detectionMethod: DetectionMethod.REGEX, confidenceScore: 0.9, snippet: m });
  }

  // Normalization pass: catches disguised forms like "john at gmail dot com"
  // that the plain regexes above miss.
  const normalized = normalize(content);
  if (normalized !== content.toLowerCase()) {
    const normalizedEmailMatches = normalized.match(EMAIL_REGEX) ?? [];
    for (const m of normalizedEmailMatches) {
      if (!emailMatches.some((existing) => existing.toLowerCase() === m)) {
        matches.push({ violationType: ViolationType.EMAIL, detectionMethod: DetectionMethod.NORMALIZATION, confidenceScore: 0.85, snippet: m });
      }
    }
  }

  matches.push(...findKeywordMatches(content, SOCIAL_MEDIA_KEYWORDS, ViolationType.SOCIAL_MEDIA, 0.7));
  matches.push(...findKeywordMatches(content, PAYMENT_KEYWORDS, ViolationType.PAYMENT_HANDLE, 0.75));
  matches.push(...findKeywordMatches(content, OFF_PLATFORM_PHRASES, ViolationType.OFF_PLATFORM_REQUEST, 0.6));

  if (matches.length > 0) {
    for (const match of matches) {
      if (match.snippet) {
        sanitizedContent = sanitizedContent.split(match.snippet).join('[removed]');
      }
    }
  }

  return {
    blocked: matches.length > 0,
    sanitizedContent,
    matches,
  };
}
