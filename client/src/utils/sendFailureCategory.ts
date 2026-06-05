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

export function getFailureBranchLabel(category: string): string {
  return SEND_FAILURE_BRANCH_OPTIONS.find((option) => option.id === category)?.label || category;
}

export function getFailureBranchHandleId(category: SendFailureCategory): string {
  return `fail-${category}`;
}

export function parseFailureBranchHandleId(handleId?: string | null): SendFailureCategory | null {
  if (!handleId || !handleId.startsWith('fail-')) return null;
  const category = handleId.slice('fail-'.length) as SendFailureCategory;
  return SEND_FAILURE_BRANCH_OPTIONS.some((option) => option.id === category) ? category : null;
}
