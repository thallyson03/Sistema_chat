import fs from 'fs';
import NodeClam from 'clamscan';
import { logger } from '../utils/logger';

type ClamScanner = NodeClam;

let scannerPromise: Promise<ClamScanner | null> | null = null;

function isAntivirusEnabled(): boolean {
  const raw = String(process.env.CLAMAV_ENABLED || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

async function getScanner(): Promise<ClamScanner | null> {
  if (!isAntivirusEnabled()) return null;

  if (!scannerPromise) {
    scannerPromise = (async () => {
      const host = process.env.CLAMAV_HOST || '127.0.0.1';
      const port = Number(process.env.CLAMAV_PORT || 3310);

      const clam = await new NodeClam().init({
        removeInfected: false,
        quarantineInfected: false,
        scanLog: null,
        debugMode: process.env.NODE_ENV !== 'production',
        clamdscan: {
          host,
          port,
          timeout: Number(process.env.CLAMAV_TIMEOUT_MS || 60_000),
        },
        preference: 'clamdscan',
      });

      logger.info('clamav scanner initialized', { host, port });
      return clam;
    })().catch((error) => {
      scannerPromise = null;
      throw error;
    });
  }

  return scannerPromise;
}

export interface AntivirusScanResult {
  clean: boolean;
  skipped: boolean;
  viruses?: string[];
  error?: string;
}

/**
 * Escaneia arquivo em disco. Se CLAMAV_ENABLED=false, retorna clean com skipped=true.
 */
export async function scanFileOnDisk(filePath: string): Promise<AntivirusScanResult> {
  if (!isAntivirusEnabled()) {
    return { clean: true, skipped: true };
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return { clean: false, skipped: false, error: 'Arquivo não encontrado para varredura' };
  }

  try {
    const clam = await getScanner();
    if (!clam) {
      return { clean: true, skipped: true };
    }

    const { isInfected, viruses } = await clam.scanFile(filePath);
    if (isInfected) {
      return {
        clean: false,
        skipped: false,
        viruses: viruses || ['unknown'],
      };
    }

    return { clean: true, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('antivirus scan failed', { filePath, message });

    if (process.env.NODE_ENV === 'production') {
      return {
        clean: false,
        skipped: false,
        error: 'Serviço de antivírus indisponível',
      };
    }

    logger.warn('antivirus unavailable in non-production — allowing file', { filePath });
    return { clean: true, skipped: true, error: message };
  }
}

export async function rejectIfInfected(
  filePath: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const result = await scanFileOnDisk(filePath);

  if (result.clean) {
    return { ok: true };
  }

  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignora falha ao remover infectado
  }

  if (result.viruses?.length) {
    return {
      ok: false,
      status: 400,
      error: 'Arquivo rejeitado: possível malware detectado',
    };
  }

  return {
    ok: false,
    status: 503,
    error: result.error || 'Varredura de antivírus indisponível',
  };
}
