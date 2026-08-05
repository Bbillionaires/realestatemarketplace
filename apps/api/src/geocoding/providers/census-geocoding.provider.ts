import { Injectable, Logger } from '@nestjs/common';
import { GeocodeAddressInput, GeocodeResult, GeocodingProvider } from '../interfaces/geocoding-provider.interface';

interface CensusGeocoderResponse {
  result?: {
    addressMatches?: { coordinates: { x: number; y: number } }[];
  };
}

/**
 * US Census Bureau's free, keyless public geocoder
 * (https://geocoding.geo.census.gov). US addresses only — fine for this
 * platform's current US-only rental market. Returns null (rather than
 * throwing) on no match so callers can treat "couldn't geocode this one
 * address" as a normal, non-fatal outcome.
 */
@Injectable()
export class CensusGeocodingProvider implements GeocodingProvider {
  private readonly logger = new Logger(CensusGeocodingProvider.name);

  async geocode(input: GeocodeAddressInput): Promise<GeocodeResult | null> {
    const oneLine = [input.addressLine1, input.city, input.state, input.zip].filter(Boolean).join(', ');
    const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
    url.searchParams.set('address', oneLine);
    url.searchParams.set('benchmark', 'Public_AR_Current');
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString());
    if (!response.ok) {
      this.logger.warn(`Census geocoder returned HTTP ${response.status} for "${oneLine}"`);
      return null;
    }

    const body = (await response.json()) as CensusGeocoderResponse;
    const match = body.result?.addressMatches?.[0];
    if (!match) {
      return null;
    }

    return { latitude: match.coordinates.y, longitude: match.coordinates.x };
  }
}
