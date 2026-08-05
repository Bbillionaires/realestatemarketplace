import { Injectable, Logger } from '@nestjs/common';
import {
  FindNearbySchoolsInput,
  NearbySchoolResult,
  SchoolsProvider,
} from '../interfaces/schools-provider.interface';

/**
 * In-memory schools provider for local development and automated tests. No
 * network calls are made. Always returns the same deterministic three-school
 * list (one per level) so callers/tests can assert on stable content instead
 * of depending on a real, metered third-party API.
 */
@Injectable()
export class MockSchoolsProvider implements SchoolsProvider {
  private readonly logger = new Logger(MockSchoolsProvider.name);

  async findNearby(input: FindNearbySchoolsInput): Promise<NearbySchoolResult[]> {
    this.logger.debug(`[mock-schools] findNearby ${input.latitude},${input.longitude}`);
    return [
      {
        externalId: 'mock-elem-1',
        name: 'Riverside Elementary School',
        schoolType: 'PUBLIC',
        level: 'ELEMENTARY',
        rating: 7,
        distanceMiles: 0.4,
        address: '100 Riverside Ave',
        websiteUrl: 'https://example-schools.test/riverside-elementary',
      },
      {
        externalId: 'mock-middle-1',
        name: 'Downtown Middle School',
        schoolType: 'PUBLIC',
        level: 'MIDDLE',
        rating: 6,
        distanceMiles: 0.9,
        address: '200 Main St',
        websiteUrl: 'https://example-schools.test/downtown-middle',
      },
      {
        externalId: 'mock-high-1',
        name: 'Jacksonville High School',
        schoolType: 'PUBLIC',
        level: 'HIGH',
        rating: 8,
        distanceMiles: 1.6,
        address: '300 Duval St',
        websiteUrl: 'https://example-schools.test/jacksonville-high',
      },
    ];
  }
}
