import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  @IsOptional()
  NODE_ENV?: string;

  @IsInt()
  @IsOptional()
  PORT?: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  PHONE_ENCRYPTION_KEY!: string;

  @IsString()
  @IsNotEmpty()
  PHONE_HASH_SECRET!: string;

  @IsIn(['mock', 'twilio', 'telnyx'])
  @IsOptional()
  SMS_PROVIDER?: string;

  @IsIn(['mock', 'square'])
  @IsOptional()
  PAYMENT_PROVIDER?: string;

  @IsIn(['mock', 'census'])
  @IsOptional()
  GEOCODING_PROVIDER?: string;

  @IsIn(['mock', 'greatschools'])
  @IsOptional()
  SCHOOLS_PROVIDER?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  AUTH_RATE_LIMIT_PER_MIN?: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration: ${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('; ')}`,
    );
  }
  return validatedConfig;
}
