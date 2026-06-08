import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { auditLogService, AuditAction } from '../services/auditLogService';

export function auditAction(
  action: AuditAction,
  resource?: string,
  getResourceId?: (req: AuthRequest) => string | undefined,
) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      auditLogService.log({
        userId: req.user?.id,
        action,
        resource,
        resourceId: getResourceId ? getResourceId(req) : undefined,
        ip: req.ip || req.socket.remoteAddress || undefined,
        userAgent: req.headers['user-agent'] || undefined,
      });
    });
    next();
  };
}
