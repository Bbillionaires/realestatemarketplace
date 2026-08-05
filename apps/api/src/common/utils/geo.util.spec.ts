import { boundingBox, haversineMiles } from './geo.util';

describe('haversineMiles', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMiles(30.3322, -81.6557, 30.3322, -81.6557)).toBeCloseTo(0, 5);
  });

  it('matches a known distance (roughly Jacksonville to Orlando, ~130 miles)', () => {
    const distance = haversineMiles(30.3322, -81.6557, 28.5383, -81.3792);
    expect(distance).toBeGreaterThan(120);
    expect(distance).toBeLessThan(140);
  });

  it('is symmetric', () => {
    const a = haversineMiles(30.3322, -81.6557, 30.35, -81.66);
    const b = haversineMiles(30.35, -81.66, 30.3322, -81.6557);
    expect(a).toBeCloseTo(b, 10);
  });
});

describe('boundingBox', () => {
  it('produces a box that contains the center point', () => {
    const box = boundingBox(30.3322, -81.6557, 5);
    expect(box.minLat).toBeLessThan(30.3322);
    expect(box.maxLat).toBeGreaterThan(30.3322);
    expect(box.minLon).toBeLessThan(-81.6557);
    expect(box.maxLon).toBeGreaterThan(-81.6557);
  });

  it('produces a box that contains a point known to be within the radius', () => {
    const center = { lat: 30.3322, lon: -81.6557 };
    const nearby = { lat: 30.34, lon: -81.66 }; // well under a mile away
    const box = boundingBox(center.lat, center.lon, 1.5);
    expect(nearby.lat).toBeGreaterThanOrEqual(box.minLat);
    expect(nearby.lat).toBeLessThanOrEqual(box.maxLat);
    expect(nearby.lon).toBeGreaterThanOrEqual(box.minLon);
    expect(nearby.lon).toBeLessThanOrEqual(box.maxLon);
  });
});
