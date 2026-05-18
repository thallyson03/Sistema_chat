export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length <= 11 && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
}

export function getConversationChannelLabel(conv: {
  channel?: { name: string } | null;
  channelSnapshot?: {
    name?: string;
    channelId?: string;
  } | null;
  channelDisplayName?: string;
}): string {
  if (conv.channelDisplayName) return conv.channelDisplayName;
  if (conv.channel?.name) return conv.channel.name;
  const snap = conv.channelSnapshot;
  if (snap?.name) {
    return conv.channel ? snap.name : `${snap.name} (canal removido)`;
  }
  return 'Sem canal';
}
