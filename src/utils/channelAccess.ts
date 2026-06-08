import prisma from '../config/database';
import { AccessViewer } from './accessControl';

export async function canUserAccessChannel(
  viewer: AccessViewer,
  channelId: string,
): Promise<boolean> {
  if (viewer.role === 'ADMIN' || viewer.role === 'SUPERVISOR') return true;

  const channelAccess = await prisma.userChannelAccess.findFirst({
    where: { userId: viewer.id, channelId },
  });
  if (channelAccess) return true;

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      sectorId: true,
      secondarySectors: { select: { sectorId: true } },
    },
  });
  if (!channel) return false;

  const userSectors = await prisma.userSector.findMany({
    where: { userId: viewer.id },
    select: { sectorId: true },
  });
  const sectorIds = new Set(userSectors.map((s) => s.sectorId));

  if (channel.sectorId && sectorIds.has(channel.sectorId)) return true;

  return channel.secondarySectors.some((s) => sectorIds.has(s.sectorId));
}

export function extractWhatsAppAppSecret(config: Record<string, unknown> | null | undefined): string {
  if (!config || typeof config !== 'object') return '';
  const candidates = [
    config.appSecret,
    config.whatsappAppSecret,
    config.metaAppSecret,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

export function validateWhatsAppOfficialConfig(
  config: Record<string, unknown> | null | undefined,
  options?: { requireAppSecret?: boolean },
): string | null {
  const provider = String(config?.provider || '').toLowerCase();
  if (provider !== 'whatsapp_official') return null;

  const token = String(config?.token || '').trim();
  const phoneNumberId = String(config?.phoneNumberId || '').trim();
  const appSecret = extractWhatsAppAppSecret(config);

  if (!token) return 'Access Token é obrigatório para WhatsApp Official';
  if (!phoneNumberId) return 'Phone Number ID é obrigatório para WhatsApp Official';
  if (options?.requireAppSecret !== false && !appSecret) {
    return 'App Secret do app Meta é obrigatório para validar webhooks com segurança';
  }
  return null;
}
