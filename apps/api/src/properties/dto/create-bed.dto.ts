import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateBedDto {
  @IsString()
  @MinLength(1)
  bedLabel!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rentCents?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
