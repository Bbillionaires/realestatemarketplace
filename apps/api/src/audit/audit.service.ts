import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          metadata: input.metadata ? (input.metadata as never) : undefined,
        },
      });
    } catch (err) {
      // Audit logging must never break the primary request flow.
      this.logger.error('Failed to write audit log', err instanceof Error ? err.stack : err);
    }
  }

  async findAll(params: { skip?: number; take?: number; entityType?: string; actorId?: string }) {
    const { skip = 0, take = 50, entityType, actorId } = params;
    return this.prisma.auditLog.findMany({
      where: {
        entityType: entityType ?? undefined,
        actorId: actorId ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }
}
