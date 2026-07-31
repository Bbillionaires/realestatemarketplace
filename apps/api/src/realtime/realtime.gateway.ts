import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { MessageResponseDto } from '../messages/dto/message-response.dto';
import { corsOriginValidator, parseAllowedOrigins } from '../common/utils/cors-origins.util';

interface AuthedSocket extends Socket {
  data: { userId?: string };
}

/**
 * Pushes new messages and conversation-status changes to whichever clients
 * have joined that conversation's room, so the dashboard doesn't need to
 * poll. Falls back gracefully: if a client never connects (or the socket
 * drops), nothing breaks — the REST endpoints are still the source of
 * truth, this is purely a "wake up and refetch/append" signal.
 *
 * Auth happens once at connection time (JWT passed via the socket.io
 * handshake `auth.token`, verified the same way the HTTP JwtStrategy
 * does); joining a specific conversation room additionally checks that the
 * connected user is actually a participant, so one tenant's socket can
 * never be handed another tenant's messages.
 */
@WebSocketGateway({
  namespace: 'conversations',
  cors: {
    origin: corsOriginValidator(parseAllowedOrigins(process.env.DASHBOARD_BASE_URL, 'http://localhost:3000')),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: AuthedSocket): Promise<void> {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('missing token');

      const jwtConfig = this.configService.get('jwt', { infer: true }) as AppConfig['jwt'];
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token, {
        secret: jwtConfig.accessSecret,
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new Error('invalid user');

      socket.data.userId = user.id;
    } catch {
      this.logger.debug(`Rejecting unauthenticated socket ${socket.id}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // No server-side state to clean up — socket.io drops room membership automatically.
  }

  @SubscribeMessage('join')
  async handleJoin(socket: AuthedSocket, payload: { conversationId: string }): Promise<void> {
    const userId = socket.data.userId;
    if (!userId || !payload?.conversationId) return;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: payload.conversationId },
    });
    if (!conversation) return;

    const isParticipant =
      conversation.tenantId === userId ||
      conversation.landlordId === userId ||
      !!(await this.prisma.conversationParticipant.findFirst({
        where: { conversationId: payload.conversationId, userId, leftAt: null },
      }));
    if (!isParticipant) return;

    await socket.join(this.room(payload.conversationId));
  }

  emitNewMessage(conversationId: string, message: MessageResponseDto): void {
    this.server?.to(this.room(conversationId)).emit('message:new', message);
  }

  /** Lightweight status-change signal — clients refetch full details over REST if they need more. */
  emitConversationUpdated(conversationId: string, patch: { status: string }): void {
    this.server?.to(this.room(conversationId)).emit('conversation:updated', { id: conversationId, ...patch });
  }

  emitShowingUpdated(conversationId: string, showing: unknown): void {
    this.server?.to(this.room(conversationId)).emit('showing:updated', showing);
  }

  private room(conversationId: string): string {
    return `conversation:${conversationId}`;
  }
}
