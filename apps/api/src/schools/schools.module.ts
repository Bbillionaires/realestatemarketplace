import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { SCHOOLS_PROVIDER } from './schools.constants';
import { MockSchoolsProvider } from './providers/mock-schools.provider';
import { GreatSchoolsProvider } from './providers/greatschools-schools.provider';

/**
 * Binds the SCHOOLS_PROVIDER token to a concrete SchoolsProvider based on
 * the SCHOOLS_PROVIDER env var, mirroring SmsModule/PaymentsModule/
 * GeocodingModule so no caller needs to know which data source is active.
 */
@Global()
@Module({
  providers: [
    MockSchoolsProvider,
    GreatSchoolsProvider,
    {
      provide: SCHOOLS_PROVIDER,
      inject: [ConfigService, MockSchoolsProvider, GreatSchoolsProvider],
      useFactory: (
        configService: ConfigService<AppConfig>,
        mock: MockSchoolsProvider,
        greatschools: GreatSchoolsProvider,
      ) => {
        const provider = configService.get('schoolsProvider', { infer: true });
        switch (provider) {
          case 'greatschools':
            return greatschools;
          case 'mock':
          default:
            return mock;
        }
      },
    },
  ],
  exports: [SCHOOLS_PROVIDER, MockSchoolsProvider],
})
export class SchoolsModule {}
