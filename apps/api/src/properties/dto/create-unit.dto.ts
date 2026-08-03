import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

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
}
