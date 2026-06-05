import type { WhatsAppSendErrorPayload } from './whatsappMessagingWindow';
import { parseWhatsAppErrorCodeFromMessage } from './whatsappMessagingWindow';

export type SendFailureCategory =
  | 'invalid_number'
  | 'window_24h'
  | 'rate_limit'
  | 'undeliverable'
  | 'blocked'
  | 'media_error'
  | 'template_error'
  | 'payment'
  | 'unknown';

export interface SendFailureBranchOption {
  id: SendFailureCategory;
  label: string;
  description: string;
}

export const SEND_FAILURE_BRANCH_OPTIONS: SendFailureBranchOption[] = [
  {
    id: 'invalid_number',
    label: 'Número inválido',
    description: 'Número inexistente, incorreto ou sem WhatsApp',
  },
  {
    id: 'window_24h',
    label: 'Janela 24h',
    description: 'Cliente não respondeu nas últimas 24 horas',
  },
  {
    id: 'rate_limit',
    label: 'Limite de envio',
    description: 'Rate limit, spam ou throughput da Meta',
  },
  {
    id: 'undeliverable',
    label: 'Não entregue',
    description: 'Mensagem não pôde ser entregue ao destinatário',
  },
  {
    id: 'blocked',
    label: 'Bloqueado / opt-out',
    description: 'Usuário bloqueou o negócio ou recusou marketing',
  },
  {
    id: 'media_error',
    label: 'Erro de mídia',
    description: 'Falha ao enviar imagem, áudio, vídeo ou documento',
  },
  {
    id: 'template_error',
    label: 'Erro de template',
    description: 'Template inexistente, reprovado ou variáveis inválidas',
  },
  {
    id: 'payment',
    label: 'Pagamento / conta',
    description: 'Problema de billing ou configuração da conta Meta',
  },
  {
    id: 'unknown',
    label: 'Outros erros',
    description: 'Qualquer falha não mapeada nas categorias acima',
  },
];

const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131048, 131056, 131064]);
const TEMPLATE_CODES = new Set([132000, 132001, 132005, 132007, 132012, 132015, 131063]);
const PAYMENT_CODES = new Set([131042, 131037, 131045, 131057]);
const BLOCKED_CODES = new Set([130403, 131050]);
const MEDIA_CODES = new Set([131053, 131052]);

function resolveNumericCode(
  sendError?: WhatsAppSendErrorPayload | null,
  error?: unknown,
): number | null {
  if (sendError?.code != null && sendError.code !== '') {
    const parsed = Number(sendError.code);
    if (Number.isFinite(parsed)) return parsed;
  }
  const fromMessage = parseWhatsAppErrorCodeFromMessage(sendError?.message);
  if (fromMessage != null) return fromMessage;

  const err = error as { code?: string; message?: string };
  if (err?.code === 'MESSAGING_WINDOW_CLOSED') return 131047;
  return parseWhatsAppErrorCodeFromMessage(err?.message);
}

export function categorizeSendFailure(
  sendError?: WhatsAppSendErrorPayload | null,
  error?: unknown,
): SendFailureCategory {
  const err = error as { code?: string; message?: string };
  if (err?.code === 'MESSAGING_WINDOW_CLOSED') {
    return 'window_24h';
  }

  const code = resolveNumericCode(sendError, error);
  const haystack = `${sendError?.message || ''} ${sendError?.details || ''} ${err?.message || ''}`.toLowerCase();

  if (code === 131047) return 'window_24h';
  if (code === 131009 || code === 131021) return 'invalid_number';
  if (code === 131026 || code === 131049 || code === 130472) return 'undeliverable';
  if (code != null && RATE_LIMIT_CODES.has(code)) return 'rate_limit';
  if (code != null && TEMPLATE_CODES.has(code)) return 'template_error';
  if (code != null && PAYMENT_CODES.has(code)) return 'payment';
  if (code != null && BLOCKED_CODES.has(code)) return 'blocked';
  if (code != null && MEDIA_CODES.has(code)) return 'media_error';

  if (
    haystack.includes('invalid') &&
    (haystack.includes('number') || haystack.includes('número') || haystack.includes('phone'))
  ) {
    return 'invalid_number';
  }
  if (haystack.includes('24 hour') || haystack.includes('24 horas') || haystack.includes('re-engagement')) {
    return 'window_24h';
  }
  if (haystack.includes('rate limit') || haystack.includes('throughput') || haystack.includes('spam')) {
    return 'rate_limit';
  }
  if (haystack.includes('template')) return 'template_error';
  if (haystack.includes('media') || haystack.includes('mídia')) return 'media_error';
  if (haystack.includes('blocked') || haystack.includes('bloqueado') || haystack.includes('opt-out')) {
    return 'blocked';
  }
  if (haystack.includes('payment') || haystack.includes('billing') || haystack.includes('pagamento')) {
    return 'payment';
  }
  if (haystack.includes('undeliverable') || haystack.includes('não entreg') || haystack.includes('not deliver')) {
    return 'undeliverable';
  }

  return 'unknown';
}

export function resolveFailureBranchStepId(
  failureBranches: Record<string, string> | null | undefined,
  category: SendFailureCategory,
): string | null {
  const branches = failureBranches || {};
  const direct = String(branches[category] || '').trim();
  if (direct) return direct;

  if (category !== 'unknown') {
    const fallback = String(branches.unknown || '').trim();
    if (fallback) return fallback;
  }

  return null;
}

export function getFailureBranchLabel(category: string): string {
  return SEND_FAILURE_BRANCH_OPTIONS.find((option) => option.id === category)?.label || category;
}
