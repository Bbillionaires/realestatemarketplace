import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PropertyType, SewerSourceType, UtilityType, WaterSourceType } from '@prisma/client';

const PROPERTY_TYPES = Object.values(PropertyType);
const UTILITY_TYPES = Object.values(UtilityType);
const SEWER_SOURCE_TYPES = Object.values(SewerSourceType);
const WATER_SOURCE_TYPES = Object.values(WaterSourceType);

export class CreatePropertyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsString()
  @MaxLength(50)
  state!: string;

  @IsString()
  @MaxLength(20)
  zip!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  monthlyRentCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  depositCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  petPolicy?: string;

  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  propertyType?: PropertyType;

  @IsOptional()
  @IsBoolean()
  acceptsSection8Vouchers?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  amenities?: string;

  @IsOptional()
  @IsArray()
  @IsIn(UTILITY_TYPES, { each: true })
  utilitiesIncluded?: UtilityType[];

  @IsOptional()
  @IsIn(SEWER_SOURCE_TYPES)
  sewerSource?: SewerSourceType;

  @IsOptional()
  @IsIn(WATER_SOURCE_TYPES)
  waterSource?: WaterSourceType;

  @IsOptional()
  @IsBoolean()
  landlordPaysElectricity?: boolean;

  @IsOptional()
  @IsBoolean()
  landlordPaysWater?: boolean;

  /** Landlord allows the tenant to sublease the unit to another party. */
  @IsOptional()
  @IsBoolean()
  subleaseAllowed?: boolean;

  /** Month/year the current tenant's lease ends, if occupied. */
  @IsOptional()
  @IsDateString()
  currentLeaseEndDate?: string;

  /** Landlord notes the property will likely be listed for sale in the near future. */
  @IsOptional()
  @IsBoolean()
  sellingSoon?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  sellingSoonNote?: string;

  @IsOptional()
  @IsBoolean()
  rentToOwnAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  leaseToOwnAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  sellerFinancingAvailable?: boolean;

  /** Landlord is open to trading work/labor in exchange for rent. */
  @IsOptional()
  @IsBoolean()
  workForRentAvailable?: boolean;

  /** Landlord allows a current tenant to swap leases/units with another equally-qualified tenant. */
  @IsOptional()
  @IsBoolean()
  tenantSwapAllowed?: boolean;

  /** Landlord is open to applicants with a prior eviction, credit issue, or justice-involvement. */
  @IsOptional()
  @IsBoolean()
  secondChanceFriendly?: boolean;
}
