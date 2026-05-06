import prisma from '../config/database';
import { logger } from '../utils/logger';
import { objectStorageService } from './objectStorageService';

type JobCounters = {
  scanned: number;
  eligible: number;
  deleted: number;
  skipped: number;
  failed: number;
};

function isEnabled(): boolean {
  return String(process.env.MEDIA_RETENTION_ENABLED || 'false').trim().toLowerCase() === 'true';
}

function isDryRun(): boolean {
  const raw = String(process.env.MEDIA_RETENTION_DRY_RUN || 'true').trim().toLowerCase();
  return raw !== 'false';
}

function retentionDays(): number {
  return Math.max(1, Number(process.env.MEDIA_RETENTION_DAYS) || 120);
}

function batchSize(): number {
  return Math.min(200, Math.max(1, Number(process.env.MEDIA_RETENTION_BATCH_SIZE) || 50));
}

function extractStorageKey(metadata: any): string | null {
  const keyFromMetadata = metadata?.mediaMetadata?.storageKey;
  if (typeof keyFromMetadata === 'string' && keyFromMetadata.trim()) return keyFromMetadata.trim();

  const mediaUrl = metadata?.mediaUrl;
  if (typeof mediaUrl !== 'string' || !mediaUrl.startsWith('http')) return null;

  try {
    const parsed = new URL(mediaUrl);
    const rawPath = parsed.pathname.replace(/^\/+/, '');
    if (!rawPath) return null;
    const bucket = objectStorageService.getBucket();
    if (bucket && rawPath.startsWith(`${bucket}/`)) return rawPath.slice(bucket.length + 1);
    return rawPath;
  } catch (_) {
    return null;
  }
}

export async function runMediaRetentionJobTick(): Promise<void> {
  if (!isEnabled()) return;
  if (!objectStorageService.isEnabled()) {
    logger.warn('media retention skipped: object storage disabled');
    return;
  }

  const counters: JobCounters = { scanned: 0, eligible: 0, deleted: 0, skipped: 0, failed: 0 };
  const dryRun = isDryRun();
  const days = retentionDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const candidates = await prisma.message.findMany({
    where: {
      type: { in: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'] },
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize(),
  });

  counters.scanned = candidates.length;

  for (const message of candidates) {
    try {
      const metadata: any = message.metadata || {};
      if (metadata?.mediaDeletedAt) {
        counters.skipped += 1;
        continue;
      }

      const storageKey = extractStorageKey(metadata);
      if (!storageKey) {
        counters.skipped += 1;
        continue;
      }

      counters.eligible += 1;
      if (dryRun) {
        logger.info('media retention dry-run candidate', {
          messageId: message.id,
          createdAt: message.createdAt.toISOString(),
          storageKey,
          retentionDays: days,
        });
        continue;
      }

      await objectStorageService.deleteObject(storageKey);

      const newMetadata = {
        ...metadata,
        mediaUrl: null,
        mediaDeletedAt: new Date().toISOString(),
        mediaRetentionPolicyDays: days,
        mediaDeletedReason: 'retention_policy',
        mediaMetadata: {
          ...(metadata?.mediaMetadata || {}),
          storageKey,
          storageDeletedAt: new Date().toISOString(),
        },
      };

      await prisma.message.update({
        where: { id: message.id },
        data: { metadata: newMetadata as any },
      });

      counters.deleted += 1;
    } catch (error: any) {
      counters.failed += 1;
      logger.errorWithCause('media retention failed for message', error, {
        messageId: message.id,
      });
    }
  }

  logger.info('media retention job tick completed', {
    ...counters,
    dryRun,
    retentionDays: days,
    cutoff: cutoff.toISOString(),
  });
}

