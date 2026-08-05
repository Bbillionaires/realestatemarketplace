import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { UnitListingType } from '@prisma/client';

export class CreateUnitDto {
  @IsString()
  @MinLength(1)
  unitLabel!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  bathrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50_000)
  squareFeet?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rentCents?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  // Defaults to ENTIRE_PLACE (the unit is rented as a whole) if omitted —
  // matches every unit created before this field existed.
  @IsOptional()
  @IsEnum(UnitListingType)
  listingType?: UnitListingType;
}
