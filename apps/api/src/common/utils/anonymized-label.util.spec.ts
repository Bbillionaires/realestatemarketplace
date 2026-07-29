import { anonymizedNumber } from './anonymized-label.util';

describe('anonymizedNumber', () => {
  it('is deterministic for the same user id', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    expect(anonymizedNumber(id)).toBe(anonymizedNumber(id));
  });

  it('differs for different user ids (almost always)', () => {
    const a = anonymizedNumber('11111111-1111-1111-1111-111111111111');
    const b = anonymizedNumber('22222222-2222-2222-2222-222222222222');
    expect(a).not.toBe(b);
  });

  it('is always a 4-digit numeric string', () => {
    const label = anonymizedNumber('33333333-3333-3333-3333-333333333333');
    expect(label).toMatch(/^\d{4}$/);
  });

  it('never reveals the underlying user id', () => {
    const id = 'bed858a9-c600-41c8-95f3-26416e50f3f0';
    expect(anonymizedNumber(id)).not.toContain(id);
  });
});
