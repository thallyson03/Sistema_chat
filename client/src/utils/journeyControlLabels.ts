import {
  formatJourneyDelayParts,
  isJourneyDelayConfigured,
  normalizeJourneyDelayConfig,
} from './journeyDelay';

export type JourneyControlType = 'delay' | 'split' | 'wait_event' | 'loop' | 'stop';

export const JOURNEY_CONTROL_META: Record<
  JourneyControlType,
  { icon: string; shortTitle: string; defaultLabel: string; description: string }
> = {
  delay: {
    icon: '⏱️',
    shortTitle: 'Esperar',
    defaultLabel: 'Controle: Esperar',
    description: 'Pausa o fluxo por um tempo antes de seguir.',
  },
  split: {
    icon: '🔀',
    shortTitle: 'Dividir A/B',
    defaultLabel: 'Controle: Dividir tráfego',
    description: 'Divide contatos entre dois caminhos (teste A/B).',
  },
  wait_event: {
    icon: '⏳',
    shortTitle: 'Aguardar evento',
    defaultLabel: 'Controle: Aguardar evento',
    description: 'Só continua quando o contato gerar o evento escolhido.',
  },
  loop: {
    icon: '🔁',
    shortTitle: 'Repetir',
    defaultLabel: 'Controle: Repetir',
    description: 'Repete um trecho do fluxo um número de vezes.',
  },
  stop: {
    icon: '🛑',
    shortTitle: 'Para o fluxo',
    defaultLabel: 'Controle: Para o fluxo',
    description: 'Encerra a jornada para este contato. Nada depois deste bloco é executado.',
  },
};

const EVENT_LABELS: Record<string, string> = {
  message_received: 'mensagem recebida',
  tag_added: 'tag adicionada',
  list_added: 'entrada na lista',
  field_updated: 'campo atualizado',
};

export function getControlSummary(config: Record<string, unknown>): string | null {
  const controlType = config.controlType as JourneyControlType | undefined;
  if (!controlType) return null;

  switch (controlType) {
    case 'delay': {
      if (!isJourneyDelayConfigured(config)) return 'Defina horas, minutos ou segundos';
      const parts = normalizeJourneyDelayConfig(config);
      return `Aguarda ${formatJourneyDelayParts(parts)}`;
    }
    case 'split': {
      const p = Number(config.splitPercent ?? 50);
      return `Caminho A: ${p}% · B: ${100 - p}%`;
    }
    case 'wait_event': {
      const ev = String(config.eventType || '');
      return ev ? `Até: ${EVENT_LABELS[ev] || ev}` : 'Escolha o evento';
    }
    case 'loop': {
      const n = Number(config.loopCount || 1);
      return `Repete até ${n}x`;
    }
    case 'stop':
      return 'Fim do fluxo para este contato';
    default:
      return null;
  }
}

export function isControlConfigured(config: Record<string, unknown>): boolean {
  const controlType = config.controlType as JourneyControlType | undefined;
  if (!controlType) return false;
  switch (controlType) {
    case 'delay':
      return isJourneyDelayConfigured(config);
    case 'split':
      return config.splitPercent !== undefined && config.splitPercent !== '';
    case 'wait_event':
      return !!config.eventType;
    case 'loop':
      return Number(config.loopCount) > 0;
    case 'stop':
      return true;
    default:
      return false;
  }
}
