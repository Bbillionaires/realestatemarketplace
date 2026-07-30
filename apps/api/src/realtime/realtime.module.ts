import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Global so MessagesModule (and anything else that creates/updates a
 * conversation or message) can inject RealtimeGateway without needing to
 * import this module explicitly, the same pattern used for SmsModule.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
