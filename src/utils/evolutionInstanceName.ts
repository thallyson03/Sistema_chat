/**
 * Converte o nome do canal (CRM) em instanceName aceito pela Evolution API.
 * Regras típicas: minúsculas, sem espaços, apenas letras, números, hífen e underscore.
 */
export function toEvolutionInstanceName(channelName: string): string {
  const slug = channelName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 55);

  const base = slug || 'channel';
  // Sufixo curto evita colisão se já existir instância com o mesmo nome.
  const suffix = Date.now().toString(36).slice(-5);
  return `${base}-${suffix}`;
}
