import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../audit/audit.service';
import { AUDIT_LOG_KEY, AuditLogMeta } from '../decorators/audit-log.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditLogMeta | undefined>(AUDIT_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!meta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    return next.handle().pipe(
      tap((result) => {
        const entityId =
          result && typeof result === 'object' && 'id' in result
            ? String((result as { id: unknown }).id)
            : (request.params?.id as string | undefined) ?? null;

        void this.auditService.log({
          actorId: user?.id ?? null,
          action: meta.action,
          entityType: meta.entityType,
          entityId,
          ipAddress: request.ip,
          userAgent: request.headers?.['user-agent'],
        });
      }),
    );
  }
}
