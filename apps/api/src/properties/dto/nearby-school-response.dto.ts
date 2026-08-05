import { SchoolLevel, SchoolType } from '@prisma/client';

export class NearbySchoolResponseDto {
  id!: string;
  name!: string;
  schoolType!: SchoolType;
  level!: SchoolLevel;
  rating!: number | null;
  distanceMiles!: number | null;
  address!: string | null;
  websiteUrl!: string | null;

  static from(school: {
    id: string;
    name: string;
    schoolType: SchoolType;
    level: SchoolLevel;
    rating: number | null;
    distanceMiles: number | null;
    address: string | null;
    websiteUrl: string | null;
  }): NearbySchoolResponseDto {
    const dto = new NearbySchoolResponseDto();
    dto.id = school.id;
    dto.name = school.name;
    dto.schoolType = school.schoolType;
    dto.level = school.level;
    dto.rating = school.rating;
    dto.distanceMiles = school.distanceMiles;
    dto.address = school.address;
    dto.websiteUrl = school.websiteUrl;
    return dto;
  }
}
