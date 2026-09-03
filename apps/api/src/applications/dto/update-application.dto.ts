import { plainToInstance, Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ApplicationOccupantDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationship?: string;
}

export class ApplicationRentalHistoryEntryDto {
  @IsString()
  @MaxLength(300)
  addressLine1!: string;

  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(50) state?: string;
  @IsOptional() @IsString() @MaxLength(20) zip?: string;
  @IsOptional() @IsString() @MaxLength(200) landlordName?: string;
  @IsOptional() @IsString() @MaxLength(50) landlordPhone?: string;
  @IsOptional() @IsString() @MaxLength(200) landlordEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  monthlyRentCents?: number;

  @IsOptional() @IsString() @MaxLength(20) moveInDate?: string;
  @IsOptional() @IsString() @MaxLength(20) moveOutDate?: string;
  @IsOptional() @IsString() @MaxLength(300) reasonForLeaving?: string;
}

export class ApplicationReferenceDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional() @IsString() @MaxLength(100) relationship?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
}

/**
 * Arrives as a JSON-encoded string in the multipart form, so it needs
 * parsing before validation runs. Elements are converted into real
 * instances of `dtoClass` here (via `plainToInstance`) rather than relying
 * on `@Type()`'s own array-element conversion — `@Type()` + `enableImplicitConversion`
 * doesn't reliably finish converting plain-object array elements into class
 * instances before class-validator's nested `forbidNonWhitelisted` check
 * runs, which otherwise rejects every property on every element as unknown.
 */
function parseJsonArray(dtoClass: new () => object) {
  return ({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') return value;
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => plainToInstance(dtoClass, item)) : parsed;
    } catch {
      return value;
    }
  };
}

/** Multipart booleans arrive as the strings "true"/"false", not real booleans. */
function parseBoolean({ value }: { value: unknown }): unknown {
  if (typeof value === 'string') return value === 'true';
  return value;
}

export class UpdateApplicationDto {
  // Identity — no SSN field, ever.
  @IsOptional() @IsString() @MaxLength(200) fullLegalName?: string;
  @IsOptional() @IsString() @MaxLength(20) dateOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(50) contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(300) currentAddressLine1?: string;
  @IsOptional() @IsString() @MaxLength(300) currentAddressLine2?: string;
  @IsOptional() @IsString() @MaxLength(100) currentCity?: string;
  @IsOptional() @IsString() @MaxLength(50) currentState?: string;
  @IsOptional() @IsString() @MaxLength(20) currentZip?: string;

  // Employment & income
  @IsOptional() @IsString() @MaxLength(200) employerName?: string;
  @IsOptional() @IsString() @MaxLength(50) employerPhone?: string;
  @IsOptional() @IsString() @MaxLength(200) position?: string;
  @IsOptional() @IsString() @MaxLength(20) employmentStartDate?: string;

  @IsOptional() @IsInt() @Min(0) @Max(100_000_00) monthlyIncomeCents?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_00) otherIncomeCents?: number;
  @IsOptional() @IsString() @MaxLength(500) otherIncomeNote?: string;

  // Current housing
  @IsOptional() @IsString() @MaxLength(500) reasonForMoving?: string;

  // Pets & vehicles
  @IsOptional() @Transform(parseBoolean) @IsBoolean() hasPets?: boolean;
  @IsOptional() @IsString() @MaxLength(500) petDetails?: string;
  @IsOptional() @Transform(parseBoolean) @IsBoolean() hasVehicles?: boolean;
  @IsOptional() @IsString() @MaxLength(500) vehicleDetails?: string;

  // Guarantor / co-signer
  @IsOptional() @Transform(parseBoolean) @IsBoolean() hasGuarantor?: boolean;
  @IsOptional() @IsString() @MaxLength(200) guarantorFullName?: string;
  @IsOptional() @IsString() @MaxLength(50) guarantorPhone?: string;
  @IsOptional() @IsEmail() guarantorEmail?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_00) guarantorMonthlyIncomeCents?: number;

  @IsOptional()
  @Transform(parseJsonArray(ApplicationOccupantDto))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationOccupantDto)
  occupants?: ApplicationOccupantDto[];

  @IsOptional()
  @Transform(parseJsonArray(ApplicationRentalHistoryEntryDto))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationRentalHistoryEntryDto)
  rentalHistory?: ApplicationRentalHistoryEntryDto[];

  @IsOptional()
  @Transform(parseJsonArray(ApplicationReferenceDto))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationReferenceDto)
  references?: ApplicationReferenceDto[];
}
