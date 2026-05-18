import { Channel, Prisma } from '@prisma/client';

export type ChannelSnapshot = {
  channelId: string;
  name: string;
  type: string;
  status?: string;
  provider?: string | null;
  evolutionInstanceId?: string | null;
  phoneNumberId?: string | null;
  capturedAt: string;
};

export function buildChannelSnapshot(channel: Channel): ChannelSnapshot {
  const config =
    channel.config && typeof channel.config === 'object' && !Array.isArray(channel.config)
      ? (channel.config as Record<string, unknown>)
      : {};

  let provider: string | null =
    typeof config.provider === 'string' ? config.provider : null;
  if (!provider && channel.evolutionInstanceId) {
    provider = 'evolution';
  }
  if (!provider && channel.type === 'WHATSAPP') {
    provider = 'whatsapp';
  }

  return {
    channelId: channel.id,
    name: channel.name,
    type: channel.type,
    status: channel.status,
    provider,
    evolutionInstanceId: channel.evolutionInstanceId ?? null,
    phoneNumberId:
      typeof config.phoneNumberId === 'string' ? config.phoneNumberId : null,
    capturedAt: new Date().toISOString(),
  };
}

export function snapshotToPrismaJson(
  snapshot: ChannelSnapshot,
): Prisma.InputJsonValue {
  return snapshot as unknown as Prisma.InputJsonValue;
}

export function getChannelDisplayName(conv: {
  channel?: { name: string } | null;
  channelSnapshot?: unknown;
}): string {
  if (conv.channel?.name) return conv.channel.name;
  const snap = conv.channelSnapshot as ChannelSnapshot | null | undefined;
  if (snap?.name) {
    return conv.channel ? snap.name : `${snap.name} (canal removido)`;
  }
  return 'Sem canal';
}

export function isConversationChannelReadOnly(conv: {
  channelId?: string | null;
  channel?: unknown;
}): boolean {
  return !conv.channelId || !conv.channel;
}
