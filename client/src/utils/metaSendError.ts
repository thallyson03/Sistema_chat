export const META_ERROR_DOCS_URL =
  'https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/';

export interface MessageSendErrorPayload {
  message?: string;
  code?: string | number | null;
  details?: string | null;
  errorSubcode?: string | number | null;
  type?: string | null;
  source?: string;
  at?: string;
}

const META_ERROR_DESCRIPTIONS: Record<number, string> = {
  4: 'O aplicativo atingiu o limite de chamadas à API da Meta. Aguarde e tente novamente mais tarde.',
  80007:
    'A conta WhatsApp Business atingiu o limite de taxa. Reduza a frequência de envios ou aguarde antes de tentar de novo.',
  130429:
    'Não é possível enviar sua mensagem agora. O limite de throughput da Cloud API foi atingido. Aguarde e tente novamente mais tarde; aumentar o intervalo entre tentativas pode ajudar.',
  130403:
    'Não é possível entregar a mensagem porque este usuário foi bloqueado pelo seu negócio no WhatsApp.',
  130472:
    'A mensagem não foi enviada porque o número do destinatário participa de um experimento da Meta.',
  131000:
    'Algo deu errado no envio. Tente novamente; se persistir, verifique o status da plataforma WhatsApp Business.',
  131005:
    'Acesso negado. Verifique se o token do canal Meta está válido e com as permissões corretas.',
  131008: 'Faltam parâmetros obrigatórios na requisição de envio.',
  131009: 'Um ou mais parâmetros do envio são inválidos. Confira número, template e mídia.',
  131016: 'Serviço temporariamente indisponível na Meta. Tente novamente em alguns minutos.',
  131021: 'O remetente e o destinatário são o mesmo número.',
  131026:
    'Não foi possível entregar a mensagem. O número pode ser inválido, o cliente pode ter bloqueado seu negócio, estar com WhatsApp desatualizado ou não ter aceitado os termos mais recentes.',
  131037:
    'O número comercial precisa de um nome de exibição aprovado antes de enviar mensagens.',
  131042:
    'Há um problema com o método de pagamento da conta WhatsApp Business. Verifique billing e forma de pagamento no Meta Business.',
  131045: 'Falha no registro do número comercial. Registre o número antes de enviar.',
  131047:
    'A janela de 24 horas expirou. Para falar com o cliente, envie um template aprovado pela Meta.',
  131048:
    'Não é possível enviar sua mensagem. A Meta pode ter restringido temporariamente sua capacidade de enviar mensagens por qualidade ou spam. Aguarde e tente novamente mais tarde; aumentar o tempo entre as tentativas pode ajudar.',
  131049:
    'A Meta optou por não entregar esta mensagem para preservar a qualidade do ecossistema. Aguarde antes de reenviar.',
  131050:
    'O destinatário optou por não receber mensagens de marketing do seu negócio.',
  131051: 'Tipo de mensagem não suportado pela API da Meta.',
  131053:
    'Não foi possível enviar a mídia. Verifique se o arquivo está acessível publicamente e em formato suportado.',
  131056:
    'Muitas mensagens enviadas para o mesmo número em pouco tempo. Aguarde antes de tentar novamente para este contato.',
  131057: 'A conta WhatsApp Business está em modo de manutenção. Tente novamente mais tarde.',
  131063:
    'Templates de marketing estão desabilitados nesta configuração da Cloud API.',
  131064:
    'Limite de mensagens atingido por violações na classificação de templates.',
  132000:
    'A quantidade de variáveis do template não confere com o template aprovado.',
  132001: 'O template não existe, não está aprovado ou o idioma informado está incorreto.',
  132007: 'O conteúdo do template viola uma política da Meta.',
  132012: 'O formato das variáveis do template está incorreto.',
};

export function parseWhatsAppErrorCode(
  sendError?: MessageSendErrorPayload | null,
): number | null {
  if (!sendError) return null;
  if (sendError.code != null && sendError.code !== '') {
    const parsed = Number(sendError.code);
    if (Number.isFinite(parsed)) return parsed;
  }
  const match = sendError.message?.match(/\(#(\d+)\)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMetaSendErrorDisplay(sendError?: MessageSendErrorPayload | null): {
  code: number | null;
  codeLabel: string | null;
  description: string;
  rawMessage: string | null;
  details: string | null;
  learnMoreUrl: string;
} {
  const code = parseWhatsAppErrorCode(sendError);
  const rawMessage = sendError?.message?.trim() || null;
  const details = sendError?.details?.trim() || null;

  let description =
    (code != null ? META_ERROR_DESCRIPTIONS[code] : undefined) ||
    details ||
    rawMessage ||
    'Não foi possível entregar a mensagem pelo WhatsApp.';

  if (code === 131047 && !description.includes('template')) {
    description =
      'A janela de 24 horas expirou. Para falar com o cliente, envie um template aprovado pela Meta.';
  }

  return {
    code,
    codeLabel: code != null ? String(code) : null,
    description,
    rawMessage,
    details,
    learnMoreUrl: META_ERROR_DOCS_URL,
  };
}
