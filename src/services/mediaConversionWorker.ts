import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { convertOggToMp3 } from '../utils/audioConverter';
import { logger } from '../utils/logger';

function getFilenameFromMediaUrl(mediaUrl: string | undefined): string | null {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null;
  if (!mediaUrl.startsWith('/api/media/file/')) return null;
  return mediaUrl.replace('/api/media/file/', '').split('?')[0] || null;
}

export async function runMediaConversionWorkerTick(): Promise<void> {
  if (process.env.MEDIA_CONVERSION_WORKER_ENABLED === 'false') {
    return;
  }

  const batchSize = Math.min(
    20,
    Math.max(1, Number(process.env.MEDIA_CONVERSION_WORKER_BATCH_SIZE) || 8),
  );

  const uploadsDir = path.join(__dirname, '../../uploads');
  const rows = await prisma.message.findMany({
    where: {
      type: 'AUDIO',
    },
    orderBy: { createdAt: 'desc' },
    take: 250,
    select: {
      id: true,
      metadata: true,
    },
  });

  const pending: Array<{ messageId: string; oggPath: string; mp3Path: string }> = [];

  for (const row of rows) {
    const metadata = row.metadata as any;
    const filename = getFilenameFromMediaUrl(metadata?.mediaUrl);
    if (!filename || !filename.toLowerCase().endsWith('.ogg')) continue;
    const oggPath = path.join(uploadsDir, filename);
    if (!fs.existsSync(oggPath)) continue;
    const mp3Filename = filename.replace(/\.ogg$/i, '.mp3');
    const mp3Path = path.join(uploadsDir, mp3Filename);
    if (fs.existsSync(mp3Path)) continue;
    pending.push({ messageId: row.id, oggPath, mp3Path });
    if (pending.length >= batchSize) break;
  }

  if (pending.length === 0) {
    return;
  }

  logger.info('media conversion worker batch started', {
    pendingCount: pending.length,
    batchSize,
  });

  for (const item of pending) {
    try {
      await convertOggToMp3(item.oggPath, item.mp3Path);
      logger.info('media conversion worker converted ogg to mp3', {
        messageId: item.messageId,
        target: path.basename(item.mp3Path),
      });
    } catch (error) {
      logger.errorWithCause('media conversion worker failed conversion', error, {
        messageId: item.messageId,
        source: path.basename(item.oggPath),
      });
    }
  }
}

