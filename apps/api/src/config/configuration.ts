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
    authPerMin: parseInt(process.env.AUTH_RATE_LIMIT_PER_MIN ?? '10', 10),
    smsSendPerMin: parseInt(process.env.SMS_SEND_RATE_LIMIT_PER_MIN ?? '5', 10),
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
    otpTtlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '600', 10),
  },
});
