import prisma from '../config/database';
import axios from 'axios';

function hasRemoteMediaUrl(metadata: unknown): boolean {
  const m = metadata as { mediaUrl?: string } | null | undefined;
  const url = m?.mediaUrl;
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

/**
 * Tenta persistir mídia recebida (WhatsApp Official / Evolution) antes das URLs expirarem.
 * Reutiliza GET /api/media/:messageId, que já baixa, grava em uploads/ e atualiza metadata.
 */
export async function runMediaPersistJobTick(): Promise<void> {
  if (process.env.MEDIA_PERSIST_JOB_ENABLED === 'false') {
    return;
  }

  const batchSize = Math.min(
    50,
    Math.max(1, Number(process.env.MEDIA_PERSIST_BATCH_SIZE) || 12),
  );
  const maxAgeHours = Math.min(
    168,
    Math.max(1, Number(process.env.MEDIA_PERSIST_MAX_AGE_HOURS) || 72),
  );

  const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const candidates = await prisma.message.findMany({
    where: {
      type: { in: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'] },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: { id: true, metadata: true },
  });

  const pendingIds = candidates
    .filter((row) => hasRemoteMediaUrl(row.metadata))
    .slice(0, batchSize)
    .map((row) => row.id);

  if (pendingIds.length === 0) {
    return;
  }

  const port = String(process.env.PORT || 3007);
  const base = `http://127.0.0.1:${port}`;

  console.log(
    `[MediaPersistJob] Processando ${pendingIds.length} mídia(s) com URL remota (batch até ${batchSize})…`,
  );

  for (const messageId of pendingIds) {
    try {
      const res = await axios.get(`${base}/api/media/${messageId}`, {
        responseType: 'arraybuffer',
        timeout: 180_000,
        validateStatus: () => true,
      });

      if (res.status === 200) {
        console.log(`[MediaPersistJob] OK messageId=${messageId} bytes=${res.data?.byteLength ?? 0}`);
      } else {
        console.warn(
          `[MediaPersistJob] Falha HTTP ${res.status} messageId=${messageId}`,
          typeof res.data === 'string' ? res.data.substring(0, 120) : '',
        );
      }
    } catch (err: any) {
      console.error(`[MediaPersistJob] Erro messageId=${messageId}:`, err?.message || err);
    }
  }
}
