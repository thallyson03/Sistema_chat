/** Formato interno de botão (bot, API CRM, WhatsApp Official). */
export type CrmInteractiveButton = {
  id?: string;
  text?: string;
  title?: string;
  value?: string;
  description?: string;
  section?: string;
  type?: string;
  url?: string;
  phoneNumber?: string;
};

export function shouldSendAsInteractiveList(
  buttons: CrmInteractiveButton[],
  metadata?: Record<string, unknown>,
): boolean {
  const interactiveType = String(metadata?.interactiveType || '').toLowerCase();
  return (
    interactiveType === 'list' ||
    buttons.length > 3 ||
    buttons.some(
      (btn) => typeof btn?.description === 'string' || typeof btn?.section === 'string',
    )
  );
}

/** Payload Evolution API v2 — POST /message/sendButtons/{instance} */
export function buildEvolutionButtonsPayload(params: {
  number: string;
  bodyText: string;
  footerText?: string;
  headerTitle?: string;
  buttons: CrmInteractiveButton[];
}) {
  const evolutionButtons = params.buttons.slice(0, 3).map((btn, index) => {
    const displayText = String(btn.text || btn.title || `Opção ${index + 1}`).slice(0, 20);
    const id = String(btn.id || btn.value || btn.text || `btn_${index + 1}`).slice(0, 256);
    const rawType = String(btn.type || 'reply').toLowerCase();

    if (rawType === 'url' && btn.url) {
      return {
        type: 'url',
        displayText,
        url: String(btn.url),
      };
    }
    if (rawType === 'call' && btn.phoneNumber) {
      return {
        type: 'call',
        displayText,
        phoneNumber: String(btn.phoneNumber).replace(/\D/g, ''),
      };
    }

    return {
      type: 'reply',
      displayText,
      id,
    };
  });

  return {
    number: params.number,
    title: params.headerTitle?.trim() || ' ',
    description: params.bodyText?.trim() || 'Escolha uma opção:',
    footer: params.footerText?.trim() || ' ',
    buttons: evolutionButtons,
  };
}

/** Payload Evolution API v2 — POST /message/sendList/{instance} */
export function buildEvolutionListPayload(params: {
  number: string;
  bodyText: string;
  buttonText?: string;
  footerText?: string;
  headerTitle?: string;
  sectionTitle?: string;
  buttons: CrmInteractiveButton[];
}) {
  const maxRows = params.buttons.slice(0, 10);
  const groupedBySection = new Map<string, Array<{ title: string; description?: string; rowId: string }>>();

  maxRows.forEach((btn, index) => {
    const section = String(btn.section || params.sectionTitle || 'Opções').slice(0, 24);
    const row = {
      title: String(btn.text || btn.title || `Opção ${index + 1}`).slice(0, 24),
      description: btn.description ? String(btn.description).slice(0, 72) : undefined,
      rowId: String(btn.id || btn.value || btn.text || `list_${index + 1}`).slice(0, 200),
    };
    const current = groupedBySection.get(section) || [];
    current.push(row);
    groupedBySection.set(section, current);
  });

  const sections = Array.from(groupedBySection.entries()).map(([title, rows]) => ({
    title,
    rows,
  }));

  return {
    number: params.number,
    title: params.headerTitle?.trim() || 'Menu',
    description: params.bodyText?.trim() || 'Selecione uma opção:',
    buttonText: params.buttonText?.trim() || 'Ver opções',
    footerText: params.footerText?.trim() || ' ',
    sections,
    // Algumas builds da Evolution expõem `values` no OpenAPI em vez de `sections`
    values: sections,
  };
}

export type EvolutionInteractiveReply = {
  replyType: 'button' | 'list' | 'template';
  selectedId: string;
  selectedTitle?: string;
};

function tryParseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function extractFromParamsJson(paramsJson: unknown): { id: string; title: string } {
  const parsed = tryParseJsonObject(paramsJson);
  if (!parsed) return { id: '', title: '' };
  const id = pickString(
    parsed.id,
    parsed.selected_id,
    parsed.selectedId,
    parsed.button_id,
    parsed.buttonId,
    parsed.rowId,
    parsed.reference_id,
  );
  const title = pickString(
    parsed.display_text,
    parsed.displayText,
    parsed.title,
    parsed.selected_display_text,
    parsed.selectedDisplayText,
    parsed.body,
  );
  return { id, title };
}

function extractFromMessageObject(msgObj: any): EvolutionInteractiveReply | null {
  if (!msgObj || typeof msgObj !== 'object') return null;

  const buttonsResponse = msgObj.buttonsResponseMessage;
  if (buttonsResponse) {
    const selectedId = pickString(buttonsResponse.selectedButtonId);
    const selectedTitle = pickString(
      buttonsResponse.selectedDisplayText,
      buttonsResponse.response?.selectedDisplayText,
    );
    if (selectedId || selectedTitle) {
      return {
        replyType: 'button',
        selectedId: selectedId || selectedTitle,
        selectedTitle: selectedTitle || selectedId,
      };
    }
  }

  const templateReply = msgObj.templateButtonReplyMessage;
  if (templateReply) {
    const selectedId = pickString(templateReply.selectedId);
    const selectedTitle = pickString(templateReply.selectedDisplayText);
    if (selectedId || selectedTitle) {
      return {
        replyType: 'template',
        selectedId: selectedId || selectedTitle,
        selectedTitle: selectedTitle || selectedId,
      };
    }
  }

  const listResponse = msgObj.listResponseMessage;
  const rowId = listResponse?.singleSelectReply?.selectedRowId;
  if (rowId) {
    const selectedId = pickString(rowId);
    const selectedTitle = pickString(listResponse.title, listResponse.description);
    return {
      replyType: 'list',
      selectedId,
      selectedTitle: selectedTitle || selectedId,
    };
  }

  const nativeFlow = msgObj.interactiveResponseMessage?.nativeFlowResponseMessage;
  if (nativeFlow) {
    const fromJson = extractFromParamsJson(nativeFlow.paramsJson);
    const selectedId = fromJson.id || pickString(nativeFlow.name);
    const selectedTitle = fromJson.title || pickString(nativeFlow.name);
    if (selectedId || selectedTitle) {
      return {
        replyType: 'button',
        selectedId: selectedId || selectedTitle,
        selectedTitle: selectedTitle || selectedId,
      };
    }
  }

  return null;
}

/** Busca selectedButtonId/paramsJson em qualquer nível do payload (Evolution varia o formato). */
export function deepFindEvolutionInteractiveReply(root: unknown): EvolutionInteractiveReply | null {
  if (!root || typeof root !== 'object') return null;

  const seen = new Set<object>();
  const stack: unknown[] = [root];
  let depth = 0;
  const maxDepth = 12;

  while (stack.length > 0 && depth < maxDepth) {
    const current = stack.pop();
    depth += 1;
    if (!current || typeof current !== 'object') continue;
    if (seen.has(current as object)) continue;
    seen.add(current as object);

    const direct = extractFromMessageObject(current);
    if (direct) return direct;

    const obj = current as Record<string, unknown>;
    const shallowId = pickString(obj.selectedButtonId, obj.selectedRowId, obj.selectedId);
    if (shallowId) {
      const shallowTitle = pickString(
        obj.selectedDisplayText,
        obj.title,
        obj.description,
      );
      const replyType =
        obj.selectedRowId != null || String(obj.listType || '').length > 0 ? 'list' : 'button';
      return {
        replyType: replyType as EvolutionInteractiveReply['replyType'],
        selectedId: shallowId,
        selectedTitle: shallowTitle || shallowId,
      };
    }

    if (typeof obj.paramsJson === 'string') {
      const fromJson = extractFromParamsJson(obj.paramsJson);
      if (fromJson.id || fromJson.title) {
        return {
          replyType: 'button',
          selectedId: fromJson.id || fromJson.title,
          selectedTitle: fromJson.title || fromJson.id,
        };
      }
    }

    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return null;
}

/**
 * Extrai texto/ID de respostas a botões e listas (Evolution/Baileys).
 * Retorna o ID para o bot casar e o título para exibir no CRM.
 */
export function extractEvolutionIncomingContent(
  msgObj: any,
  envelope?: { messageType?: string; root?: unknown },
): { content: string; displayText: string; interactive: EvolutionInteractiveReply } | null {
  const fromMsg =
    extractFromMessageObject(msgObj) ||
    deepFindEvolutionInteractiveReply(msgObj) ||
    deepFindEvolutionInteractiveReply(envelope?.root);

  if (fromMsg) {
    return {
      content: fromMsg.selectedId,
      displayText: fromMsg.selectedTitle || fromMsg.selectedId,
      interactive: fromMsg,
    };
  }

  const messageType = String(envelope?.messageType || '').toLowerCase();
  if (
    messageType.includes('button') ||
    messageType.includes('interactive') ||
    messageType.includes('list')
  ) {
    const fromEnvelope = deepFindEvolutionInteractiveReply(envelope?.root);
    if (fromEnvelope) {
      return {
        content: fromEnvelope.selectedId,
        displayText: fromEnvelope.selectedTitle || fromEnvelope.selectedId,
        interactive: fromEnvelope,
      };
    }
  }

  return null;
}
