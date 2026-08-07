import { corsOriginValidator, parseAllowedOrigins } from './cors-origins.util';

describe('parseAllowedOrigins', () => {
  it('falls back to the default when unset', () => {
    expect(parseAllowedOrigins(undefined, 'http://localhost:3000')).toEqual(['http://localhost:3000']);
  });

  it('splits a comma-separated list and trims whitespace', () => {
    expect(parseAllowedOrigins(' https://a.example.com , https://b.example.com', 'fallback')).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('ignores empty entries from stray commas', () => {
    expect(parseAllowedOrigins('https://a.example.com,,https://b.example.com,', 'fallback')).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });
});

describe('corsOriginValidator', () => {
  const validate = corsOriginValidator(['https://a.example.com', 'https://b.example.com']);

  it('allows a listed origin', (done) => {
    validate('https://b.example.com', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('allows requests with no Origin header (server-to-server, curl)', (done) => {
    validate(undefined, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('rejects an origin not in the list without throwing (no CORS headers, not an error)', (done) => {
    validate('https://evil.example.com', (err, allow) => {
      // Must be callback(null, false) — never callback(new Error(...)), which
      // propagates as an unhandled exception (a 500) with no filter to catch
      // it, rather than an ordinary same-origin-policy rejection.
      expect(err).toBeNull();
      expect(allow).toBe(false);
      done();
    });
  });
});
