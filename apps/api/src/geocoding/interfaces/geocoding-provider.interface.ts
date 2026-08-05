export interface GeocodeAddressInput {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zip: string;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

/**
 * Provider-agnostic geocoding gateway, mirroring SmsProvider/EmailProvider/
 * PaymentProvider: nothing outside this module knows or cares which
 * geocoder is active behind GEOCODING_PROVIDER.
 */
export interface GeocodingProvider {
  geocode(input: GeocodeAddressInput): Promise<GeocodeResult | null>;
}
