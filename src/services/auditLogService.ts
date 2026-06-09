import prisma from '../config/database';
import { logger } from '../utils/logger';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'VIEW_CONVERSATION'
  | 'DELETE_CONVERSATION'
  | 'EXPORT_CONTACTS'
  | 'DELETE_USER'
  | 'UPDATE_USER'
  | 'CREATE_DEAL'
  | 'DELETE_DEAL'
  | 'EXECUTE_CAMPAIGN'
  | 'EXECUTE_JOURNEY'
  | 'MEDIA_ACCESS'
  | 'WEBHOOK_RECEIVED'
  | 'ANONYMIZE_CONTACT'
  | 'DELETE_CONTACT'
  | 'EXPORT_CONTACT_DATA'
  | 'RECORD_CONSENT'
  | 'REVOKE_CONSENT'
  | 'CREATE_CHANNEL'
  | 'UPDATE_CHANNEL';

export interface AuditLogInput {
  userId?: string | null;
  action: AuditAction | string;
  resource?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export class AuditLogService {
  async log(input: AuditLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: input.userId || null,
          action: input.action,
          resource: input.resource || null,
          resourceId: input.resourceId || null,
          ip: input.ip || null,
          userAgent: input.userAgent || null,
          metadata: input.metadata ? (input.metadata as any) : undefined,
        },
      });
    } catch (error) {
      logger.warn('failed to write audit log', {
        action: input.action,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const auditLogService = new AuditLogService();
