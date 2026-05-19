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
