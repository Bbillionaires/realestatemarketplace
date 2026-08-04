import { buildShowingIcs } from './ics.util';

describe('buildShowingIcs', () => {
  it('produces a valid VCALENDAR/VEVENT block with the expected fields', () => {
    const ics = buildShowingIcs({
      uid: 'showing-123',
      startTime: new Date('2026-09-01T17:00:00.000Z'),
      endTime: new Date('2026-09-01T17:30:00.000Z'),
      summary: 'Showing: 123 Main Street',
      description: 'Tour with Acme Rentals',
      location: '123 Main Street, Jacksonville, FL',
    }).toString('utf8');

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:showing-123@affordablehomematch.com');
    expect(ics).toContain('DTSTART:20260901T170000Z');
    expect(ics).toContain('DTEND:20260901T173000Z');
    expect(ics).toContain('SUMMARY:Showing: 123 Main Street');
    expect(ics).toContain('LOCATION:123 Main Street\\, Jacksonville\\, FL');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('escapes commas, semicolons, and backslashes in text fields', () => {
    const ics = buildShowingIcs({
      uid: 'showing-456',
      startTime: new Date('2026-09-01T17:00:00.000Z'),
      endTime: new Date('2026-09-01T17:30:00.000Z'),
      summary: 'A; test, with \\ special chars',
      description: 'desc',
      location: 'loc',
    }).toString('utf8');

    expect(ics).toContain('SUMMARY:A\\; test\\, with \\\\ special chars');
  });
});
