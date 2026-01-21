/**
 * Calcula o tempo relativo desde uma data
 * Retorna string formatada como "há X minutos", "há 2 horas", etc.
 */
export function getTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return 'Nunca';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'agora';
  } else if (diffMinutes < 60) {
    return `há ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
  } else if (diffHours < 24) {
    return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  } else if (diffDays < 30) {
    return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  } else {
    const diffMonths = Math.floor(diffDays / 30);
    return `há ${diffMonths} mês${diffMonths > 1 ? 'es' : ''}`;
  }
}

/**
 * Formata data para exibição
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Hoje - mostrar apenas hora
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Ontem';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}

