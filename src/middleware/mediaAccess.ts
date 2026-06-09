import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth';
import { ConversationService, ConversationViewer } from '../services/conversationService';
import { verifySignedMediaFilename } from '../utils/signedMediaUrl';
import { hasInternalMediaAccess } from '../utils/internalMediaToken';
import { auditLogService } from '../services/auditLogService';

const conversationService = new ConversationService();

export function hasValidSignedFileAccess(req: Request, filename: string): boolean {
  const expires = String(req.query.expires || '');
  const sig = String(req.query.sig || '');
  return verifySignedMediaFilename(filename, expires, sig);
}

export async function findConversationIdForMediaFile(
  filename: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ conversationId: string }[]>`
    SELECT m."conversationId"
    FROM "Message" m
    WHERE m.metadata->>'fileName' = ${filename}
       OR m.metadata->>'mediaUrl' LIKE ${'%' + filename + '%'}
    ORDER BY m."createdAt" DESC
    LIMIT 1
  `;
  return rows[0]?.conversationId ?? null;
}

export async function canUserAccessMediaFile(
  filename: string,
  viewer?: ConversationViewer,
): Promise<boolean> {
  if (!viewer) return false;

  const conversationId = await findConversationIdForMediaFile(filename);
  if (!conversationId) return false;

  return conversationService.canViewerAccessConversation(conversationId, viewer);
}

export async function requireFileAccessByOwnership(
  req: AuthRequest,
  res: Response,
  filename: string,
): Promise<boolean> {
  if (hasInternalMediaAccess(req)) {
    return true;
  }

  if (hasValidSignedFileAccess(req, filename)) {
    return true;
  }

  if (!req.user) {
    res.status(401).json({
      error: 'Acesso negado. URL assinada inválida ou autenticação necessária.',
    });
    return false;
  }

  const allowed = await canUserAccessMediaFile(filename, req.user);
  if (!allowed) {
    res.status(403).json({ error: 'Acesso negado para este arquivo' });
    return false;
  }

  await auditLogService.log({
    userId: req.user.id,
    action: 'MEDIA_ACCESS',
    resource: 'media_file',
    resourceId: filename,
    ip: req.ip || req.socket.remoteAddress || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  });

  return true;
}

export async function requireMessageMediaAccess(
  req: AuthRequest,
  res: Response,
  messageId: string,
): Promise<boolean> {
  if (hasInternalMediaAccess(req)) {
    return true;
  }

  if (!req.user) {
    res.status(401).json({ error: 'Autenticação necessária' });
    return false;
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });

  if (!message) {
    res.status(404).json({ error: 'Mensagem não encontrada' });
    return false;
  }

  const canAccess = await conversationService.canViewerAccessConversation(
    message.conversationId,
    req.user,
  );

  if (!canAccess) {
    res.status(403).json({ error: 'Acesso negado para esta mídia' });
    return false;
  }

  await auditLogService.log({
    userId: req.user.id,
    action: 'MEDIA_ACCESS',
    resource: 'message',
    resourceId: messageId,
    ip: req.ip || req.socket.remoteAddress || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  });

  return true;
}

export function requireFileAccess(filename: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const allowed = await requireFileAccessByOwnership(req, res, filename);
    if (!allowed) return;
    next();
  };
}
