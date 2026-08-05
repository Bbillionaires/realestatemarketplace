export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  phoneEncryptionKey: string;
  phoneHashSecret: string;
  smsProvider: 'mock' | 'twilio' | 'telnyx';
  emailProvider: 'mock' | 'resend';
  resend: {
    apiKey: string;
    fromAddress: string;
  };
  paymentProvider: 'mock' | 'square';
  square: {
    accessToken: string;
    locationId: string;
    environment: 'sandbox' | 'production';
    webhookSignatureKey: string;
  };
  idSubmissionFeeCents: number;
  geocodingProvider: 'mock' | 'census';
  schoolsProvider: 'mock' | 'greatschools';
  greatschools: {
    apiKey: string;
  };
  rentEstimateRadiusMiles: number;
  /** Percentage (0-100) skimmed from a confirmed gig's payout to fund the voucher's face value. */
  gigJobFeePercent: number;
  twilio: {
    accountSid: string;
    authToken: string;
    messagingServiceSid: string;
  };
  telnyx: {
    apiKey: string;
    publicKey: string;
    messagingProfileId: string;
  };
  appBaseUrl: string;
  dashboardBaseUrl: string;
  rateLimits: {
    globalPerMin: number;
    authPerMin: number;
    smsSendPerMin: number;
    otpMaxAttempts: number;
    otpTtlSeconds: number;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  phoneEncryptionKey: process.env.PHONE_ENCRYPTION_KEY ?? '',
  phoneHashSecret: process.env.PHONE_HASH_SECRET ?? '',
  smsProvider: (process.env.SMS_PROVIDER as 'mock' | 'twilio' | 'telnyx') ?? 'mock',
  emailProvider: (process.env.EMAIL_PROVIDER as 'mock' | 'resend') ?? 'mock',
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    fromAddress: process.env.RESEND_FROM_ADDRESS ?? 'notifications@affordablehomematch.com',
  },
  paymentProvider: (process.env.PAYMENT_PROVIDER as 'mock' | 'square') ?? 'mock',
  square: {
    accessToken: process.env.SQUARE_ACCESS_TOKEN ?? '',
    locationId: process.env.SQUARE_LOCATION_ID ?? '',
    environment: (process.env.SQUARE_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox',
    webhookSignatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? '',
  },
  idSubmissionFeeCents: parseInt(process.env.ID_SUBMISSION_FEE_CENTS ?? '500', 10),
  geocodingProvider: (process.env.GEOCODING_PROVIDER as 'mock' | 'census') ?? 'mock',
  schoolsProvider: (process.env.SCHOOLS_PROVIDER as 'mock' | 'greatschools') ?? 'mock',
  greatschools: {
    apiKey: process.env.GREATSCHOOLS_API_KEY ?? '',
  },
  rentEstimateRadiusMiles: parseFloat(process.env.RENT_ESTIMATE_RADIUS_MILES ?? '1.5'),
  gigJobFeePercent: parseFloat(process.env.GIG_JOB_FEE_PERCENT ?? '10'),
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID ?? '',
  },
  telnyx: {
    apiKey: process.env.TELNYX_API_KEY ?? '',
    publicKey: process.env.TELNYX_PUBLIC_KEY ?? '',
    messagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID ?? '',
  },
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3001',
  dashboardBaseUrl: process.env.DASHBOARD_BASE_URL ?? 'http://localhost:3000',
  rateLimits: {
    globalPerMin: parseInt(process.env.GLOBAL_RATE_LIMIT_PER_MIN ?? '300', 10),
    authPerMin: parseInt(process.env.AUTH_RATE_LIMIT_PER_MIN ?? '10', 10),
    smsSendPerMin: parseInt(process.env.SMS_SEND_RATE_LIMIT_PER_MIN ?? '5', 10),
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
    otpTtlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '600', 10),
  },
});
