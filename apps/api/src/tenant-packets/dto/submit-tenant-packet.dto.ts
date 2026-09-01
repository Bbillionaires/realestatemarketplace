import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class TenantPacketReferenceDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationship?: string;
}

export class SubmitTenantPacketDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  backgroundExplanation?: string;

  /** Legacy free-text references — new submissions should use referenceContacts instead. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  references?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  monthlyIncomeCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  employerName?: string;

  // Arrives as a JSON-encoded string in the multipart form (alongside the
  // income-proof file upload), so it needs parsing before validation runs.
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      // Let @IsArray() below reject this cleanly rather than throwing here.
      return value;
    }
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenantPacketReferenceDto)
  referenceContacts?: TenantPacketReferenceDto[];
}
