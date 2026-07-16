import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'auditLog';

export interface AuditLogMeta {
  action: string;
  entityType: string;
}

/**
 * Marks a mutating handler for automatic audit logging by AuditInterceptor.
 * The response body's `id` field (if present) is used as the entityId.
 */
export const AuditLog = (action: string, entityType: string) =>
  SetMetadata(AUDIT_LOG_KEY, { action, entityType } as AuditLogMeta);
