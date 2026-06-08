import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth';
import { ConversationService } from '../services/conversationService';
import { verifySignedMediaFilename } from '../utils/signedMediaUrl';

const conversationService = new ConversationService();

export function hasValidSignedFileAccess(req: Request, filename: string): boolean {
  const expires = String(req.query.expires || '');
  const sig = String(req.query.sig || '');
  return verifySignedMediaFilename(filename, expires, sig);
}

export async function requireMessageMediaAccess(
  req: AuthRequest,
  res: Response,
  messageId: string,
): Promise<boolean> {
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

  return true;
}

export function requireFileAccess(filename: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (hasValidSignedFileAccess(req, filename)) {
      return next();
    }
    if (req.user) {
      return next();
    }
    return res.status(401).json({
      error: 'Acesso negado. URL assinada inválida ou autenticação necessária.',
    });
  };
}
