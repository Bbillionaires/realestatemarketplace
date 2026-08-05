export type SchoolLevel = 'PRESCHOOL' | 'ELEMENTARY' | 'MIDDLE' | 'HIGH' | 'OTHER';
export type SchoolType = 'PUBLIC' | 'PRIVATE' | 'CHARTER' | 'OTHER';

export interface FindNearbySchoolsInput {
  latitude: number;
  longitude: number;
  limit?: number;
}

export interface NearbySchoolResult {
  externalId: string | null;
  name: string;
  schoolType: SchoolType;
  level: SchoolLevel;
  /** 1-10 GreatSchools-style rating, null if the school isn't rated. */
  rating: number | null;
  distanceMiles: number | null;
  address: string | null;
  websiteUrl: string | null;
}

/**
 * Provider-agnostic "schools near a point" gateway, mirroring
 * SmsProvider/PaymentProvider/GeocodingProvider: nothing outside this
 * module knows or cares which data source is active behind
 * SCHOOLS_PROVIDER.
 */
export interface SchoolsProvider {
  findNearby(input: FindNearbySchoolsInput): Promise<NearbySchoolResult[]>;
}
