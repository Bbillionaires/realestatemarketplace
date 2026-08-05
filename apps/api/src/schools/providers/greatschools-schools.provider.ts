import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import {
  FindNearbySchoolsInput,
  NearbySchoolResult,
  SchoolLevel,
  SchoolsProvider,
  SchoolType,
} from '../interfaces/schools-provider.interface';

interface GreatSchoolsApiSchool {
  id?: string | number;
  gsId?: string | number;
  name: string;
  type?: string;
  schoolType?: string;
  levelCode?: string;
  gradeRange?: string;
  rating?: number | string | null;
  distance?: number | string;
  address?: { street?: string; city?: string; state?: string; zip?: string } | string;
  overviewLink?: string;
  websiteUrl?: string;
}

interface GreatSchoolsApiResponse {
  schools?: GreatSchoolsApiSchool[];
}

function mapLevel(levelCode?: string, gradeRange?: string): SchoolLevel {
  const value = `${levelCode ?? ''} ${gradeRange ?? ''}`.toLowerCase();
  if (value.includes('elementary')) return 'ELEMENTARY';
  if (value.includes('middle')) return 'MIDDLE';
  if (value.includes('high')) return 'HIGH';
  if (value.includes('preschool') || value.includes('pre-k')) return 'PRESCHOOL';
  return 'OTHER';
}

function mapType(type?: string): SchoolType {
  const value = (type ?? '').toLowerCase();
  if (value.includes('private')) return 'PRIVATE';
  if (value.includes('charter')) return 'CHARTER';
  if (value.includes('public')) return 'PUBLIC';
  return 'OTHER';
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function formatAddress(address: GreatSchoolsApiSchool['address']): string | null {
  if (!address) return null;
  if (typeof address === 'string') return address;
  return [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ') || null;
}

/**
 * GreatSchools NearbySchools API — the same data source Zillow/Redfin/
 * Realtor.com license, so "rating" here carries real weight for a renter
 * comparing listings, not just a bare school directory.
 *
 * IMPORTANT: GreatSchools' current NearbySchools v2 documentation is a
 * JS-rendered Postman collection this integration could not access while
 * being written, so the exact base URL, auth header name, and response
 * field names below are a best-effort match to their long-documented
 * conventions (X-API-Key header; `schools[]` array with gsId/name/type/
 * levelCode/rating/distance/address). Verify each of those against the
 * real Postman collection/account once an API key is issued, and adjust
 * this one file — nothing else in the app needs to change, since callers
 * only see the stable NearbySchoolResult shape.
 */
@Injectable()
export class GreatSchoolsProvider implements SchoolsProvider {
  private readonly logger = new Logger(GreatSchoolsProvider.name);

  constructor(private readonly configService: ConfigService<AppConfig>) {}

  async findNearby(input: FindNearbySchoolsInput): Promise<NearbySchoolResult[]> {
    const greatschools = this.configService.get('greatschools', { infer: true }) as AppConfig['greatschools'];
    if (!greatschools.apiKey) {
      this.logger.warn('GREATSCHOOLS_API_KEY is not set — skipping nearby-schools lookup');
      return [];
    }

    const url = new URL('https://api.greatschools.org/schools/nearby');
    url.searchParams.set('lat', input.latitude.toString());
    url.searchParams.set('lon', input.longitude.toString());
    url.searchParams.set('limit', String(input.limit ?? 10));

    const response = await fetch(url.toString(), {
      headers: { 'X-API-Key': greatschools.apiKey, Accept: 'application/json' },
    });
    if (!response.ok) {
      this.logger.warn(`GreatSchools API returned HTTP ${response.status}`);
      return [];
    }

    const body = (await response.json()) as GreatSchoolsApiResponse;
    const schools = body.schools ?? [];

    return schools.map((school) => ({
      externalId: school.gsId != null ? String(school.gsId) : school.id != null ? String(school.id) : null,
      name: school.name,
      schoolType: mapType(school.type ?? school.schoolType),
      level: mapLevel(school.levelCode, school.gradeRange),
      rating: toNullableNumber(school.rating),
      distanceMiles: toNullableNumber(school.distance),
      address: formatAddress(school.address),
      websiteUrl: school.overviewLink ?? school.websiteUrl ?? null,
    }));
  }
}
