import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { GEOCODING_PROVIDER } from './geocoding.constants';
import { MockGeocodingProvider } from './providers/mock-geocoding.provider';
import { CensusGeocodingProvider } from './providers/census-geocoding.provider';

/**
 * Binds the GEOCODING_PROVIDER token to a concrete GeocodingProvider based
 * on the GEOCODING_PROVIDER env var, mirroring SmsModule/EmailModule/
 * PaymentsModule so no caller needs to know which geocoder is active.
 */
@Global()
@Module({
  providers: [
    MockGeocodingProvider,
    CensusGeocodingProvider,
    {
      provide: GEOCODING_PROVIDER,
      inject: [ConfigService, MockGeocodingProvider, CensusGeocodingProvider],
      useFactory: (
        configService: ConfigService<AppConfig>,
        mock: MockGeocodingProvider,
        census: CensusGeocodingProvider,
      ) => {
        const provider = configService.get('geocodingProvider', { infer: true });
        switch (provider) {
          case 'census':
            return census;
          case 'mock':
          default:
            return mock;
        }
      },
    },
  ],
  exports: [GEOCODING_PROVIDER, MockGeocodingProvider],
})
export class GeocodingModule {}
