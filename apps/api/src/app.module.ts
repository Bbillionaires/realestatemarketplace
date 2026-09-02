import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration, { AppConfig } from './config/configuration';
import { validate } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { SmsModule } from './sms/sms.module';
import { EmailModule } from './email/email.module';
import { PaymentsModule } from './payments/payments.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { SchoolsModule } from './schools/schools.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PhoneModule } from './phone/phone.module';
import { PropertiesModule } from './properties/properties.module';
import { ModerationModule } from './moderation/moderation.module';
import { MessagesModule } from './messages/messages.module';
import { ConversationsModule } from './conversations/conversations.module';
import { SmsWebhooksModule } from './sms/sms-webhooks.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ShowingsModule } from './showings/showings.module';
import { LendersModule } from './lenders/lenders.module';
import { IdSubmissionsModule } from './id-submissions/id-submissions.module';
import { GigJobsModule } from './gig-jobs/gig-jobs.module';
import { JobReferralsModule } from './job-referrals/job-referrals.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { HqsInspectionsModule } from './hqs-inspections/hqs-inspections.module';
import { TenantPacketsModule } from './tenant-packets/tenant-packets.module';
import { HomeownershipModule } from './homeownership/homeownership.module';
import { HousingVouchersModule } from './housing-vouchers/housing-vouchers.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) => [
        {
          ttl: 60_000,
          // Global abuse-prevention ceiling shared across all routes per IP.
          // Sensitive routes (auth, OTP) layer stricter per-route @Throttle
          // limits on top of this — this one just has to be generous enough
          // that legitimate traffic (e.g. the dashboard's 5s message-thread
          // polling across several users behind the same NAT) never trips it.
          limit: (configService.get('rateLimits', { infer: true }) as AppConfig['rateLimits']).globalPerMin,
        },
      ],
    }),
    PrismaModule,
    RedisModule,
    RealtimeModule,
    CommonModule,
    AuditModule,
    SmsModule,
    EmailModule,
    PaymentsModule,
    GeocodingModule,
    SchoolsModule,
    AuthModule,
    UsersModule,
    PhoneModule,
    PropertiesModule,
    ModerationModule,
    MessagesModule,
    ConversationsModule,
    SmsWebhooksModule,
    ShowingsModule,
    LendersModule,
    IdSubmissionsModule,
    GigJobsModule,
    JobReferralsModule,
    SubscriptionsModule,
    HqsInspectionsModule,
    TenantPacketsModule,
    HomeownershipModule,
    HousingVouchersModule,
  ],
  providers: [
    // Order matters: JwtAuthGuard populates request.user, then RolesGuard
    // and ThrottlerGuard can rely on it.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
