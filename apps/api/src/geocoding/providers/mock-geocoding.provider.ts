import { Injectable, Logger } from '@nestjs/common';
import { GeocodeAddressInput, GeocodeResult, GeocodingProvider } from '../interfaces/geocoding-provider.interface';

// Arbitrary base point (downtown Jacksonville, FL) so untouched addresses in
// dev/test still land somewhere plausible relative to the seed data.
const BASE_LATITUDE = 30.3322;
const BASE_LONGITUDE = -81.6557;

function addressKey(input: GeocodeAddressInput): string {
  return [input.addressLine1, input.city, input.state, input.zip].join('|').toLowerCase().trim();
}

/** Cheap deterministic hash -> a small, reproducible offset so two calls for the same address always agree. */
function hashOffset(key: string): { dLat: number; dLon: number } {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const dLat = ((hash % 1000) / 1000) * 0.2 - 0.1;
  const dLon = (((hash >> 8) % 1000) / 1000) * 0.2 - 0.1;
  return { dLat, dLon };
}

/**
 * In-memory geocoder for local development and automated tests. No network
 * calls are made. Tests that need exact, known coordinates (e.g. to assert
 * radius-based distance filtering) can register them via `setCoordinatesFor`
 * before exercising the endpoint that triggers geocoding; anything not
 * explicitly registered falls back to a deterministic hash-based offset from
 * a fixed base point, so it's still stable across calls without any setup.
 */
@Injectable()
export class MockGeocodingProvider implements GeocodingProvider {
  private readonly logger = new Logger(MockGeocodingProvider.name);
  private readonly overrides = new Map<string, GeocodeResult>();

  async geocode(input: GeocodeAddressInput): Promise<GeocodeResult | null> {
    const key = addressKey(input);
    const override = this.overrides.get(key);
    if (override) return override;

    const { dLat, dLon } = hashOffset(key);
    const result = { latitude: BASE_LATITUDE + dLat, longitude: BASE_LONGITUDE + dLon };
    this.logger.debug(`[mock-geocoding] ${key} -> ${result.latitude},${result.longitude}`);
    return result;
  }

  setCoordinatesFor(input: GeocodeAddressInput, result: GeocodeResult): void {
    this.overrides.set(addressKey(input), result);
  }

  clear(): void {
    this.overrides.clear();
  }
}
