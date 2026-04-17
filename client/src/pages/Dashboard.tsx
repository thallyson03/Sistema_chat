import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { motion } from 'framer-motion';

/** Paleta alinhada ao mock: verde neon sobre fundo grafite */
const neon = {
  text: 'text-[#4ade80]',
  textMuted: 'text-[#86efac]',
  bar: 'bg-[#22c55e]',
  barDim: 'bg-[#2d3b32]',
  ring: 'border-[#3f5248]',
  panel: 'bg-[#141816] border-[#252b28]',
  card: 'bg-[#1a1f1c] border-[#2a322c]',
  btnSolid: 'bg-[#22c55e] text-[#052e16] hover:bg-[#4ade80]',
  btnOutline: 'border border-[#3f5248] text-[#d1fae5] hover:bg-[#22c55e]/10 hover:border-[#4ade80]/50',
};

type SatisfactionSummary = {
  sentInPeriod: number;
  completedInPeriod: number;
  pendingTotal: number;
  averageScore: number | null;
  distribution: Record<number, number>;
  responseRatePercent: number | null;
};

type SatisfactionRecent = {
  id: string;
  conversationId: string;
  score: number;
  respondedAt: string;
  contactName: string | null;
  contactPhone: string | null;
  channelName: string | null;
  sentByName: string | null;
};

type SatisfactionStatsResponse = {
  periodDays: number;
  periodStart: string;
  summary: SatisfactionSummary;
  recent: SatisfactionRecent[];
};

type DashboardPerformancePayload = {
  periodDays: number;
  periodStart: string;
  tempo: {
    avgFirstResponseMinutes: number | null;
    firstResponseSampleSize: number;
    avgClosedConversationMinutes: number | null;
    closedConversationsSampleSize: number;
  };
  usuarios: {
    userId: string;
    name: string;
    messagesSent: number;
    conversationsTouched: number;
  }[];
};

type ConversationDashboardMetrics = {
  total: number;
  open: number;
  waiting: number;
  closed: number;
  inBot: number;
  finishedByBot: number;
  filters: {
    channelId: string | null;
    sectorId: string | null;
    days: number | null;
  };
};

/** Alinha período do seletor com query `periodo` do CEAPDesk (30 | 60 | 90 | all). */
function periodoFromDays(days: number): string {
  if (days <= 30) return '30';
  if (days <= 60) return '60';
  if (days <= 90) return '90';
  return 'all';
}

function mapCeapdeskStatsToCards(raw: unknown): {
  total: number;
  open: number;
  waiting: number;
  closed: number;
} {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const open = n(o.ticketsAbertos ?? o.abertos);
  const closed = n(o.ticketsFechados ?? o.fechados);
  const waiting = n(o.ticketsAguardando ?? o.emFila ?? o.aguardando);
  let total = n(o.totalTickets ?? o.total);
  if (!total) total = open + closed + waiting;
  return { total, open, waiting, closed };
}

function buildPerfFromCeapdesk(
  completo: unknown,
  usuariosPerf: unknown,
  surveyDays: number,
): DashboardPerformancePayload {
  const c = completo && typeof completo === 'object' ? (completo as Record<string, unknown>) : null;
  const slaRaw =
    c && typeof c.slaStats === 'object' && c.slaStats !== null
      ? (c.slaStats as Record<string, unknown>)
      : c && typeof c.sla === 'object' && c.sla !== null
        ? (c.sla as Record<string, unknown>)
        : {};
  const first =
    slaRaw.tempoMedioPrimeiraRespostaMinutos != null
      ? Number(slaRaw.tempoMedioPrimeiraRespostaMinutos)
      : slaRaw.avgFirstResponseMinutes != null
        ? Number(slaRaw.avgFirstResponseMinutes)
        : null;
  let closedMin: number | null = null;
  if (slaRaw.tempoMedioResolucaoHoras != null) {
    closedMin = Number(slaRaw.tempoMedioResolucaoHoras) * 60;
  } else if (slaRaw.tempoMedioResolucaoMinutos != null) {
    closedMin = Number(slaRaw.tempoMedioResolucaoMinutos);
  }

  const up = usuariosPerf && typeof usuariosPerf === 'object' ? (usuariosPerf as Record<string, unknown>) : {};
  const rows = Array.isArray(usuariosPerf)
    ? (usuariosPerf as unknown[])
    : Array.isArray(up.data)
      ? (up.data as unknown[])
      : Array.isArray(up.items)
        ? (up.items as unknown[])
        : [];

  const usuarios = rows.slice(0, 25).map((row: unknown, idx: number) => {
    const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    return {
      userId: String(r.userId ?? r.usuarioId ?? r.id ?? idx),
      name: String(r.usuario ?? r.nome ?? r.name ?? r.usuarioResponsavel ?? '—'),
      messagesSent: Number(r.mensagens ?? r.messagesSent ?? 0) || 0,
      conversationsTouched:
        Number(r.totalTickets ?? r.totalFechado ?? r.total ?? r.ticketsResolvidos ?? 0) || 0,
    };
  });

  return {
    periodDays: surveyDays,
    periodStart: typeof c?.periodStart === 'string' ? c.periodStart : new Date().toISOString(),
    tempo: {
      avgFirstResponseMinutes: first,
      firstResponseSampleSize: Number(slaRaw.samples ?? slaRaw.amostras ?? 0) || 0,
      avgClosedConversationMinutes: closedMin,
      closedConversationsSampleSize: Number(slaRaw.closedSamples ?? 0) || 0,
    },
    usuarios,
  };
}

function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m > 0 ? `${m}min` : ''}`.trim();
}

function formatRespondedLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `Hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) {
    return `Ontem, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initialFromName(name: string | null, phone: string | null) {
  const s = (name || phone || '?').trim();
  const ch = s.charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

function exportSurveyCsv(data: SatisfactionStatsResponse) {
  const header = ['contato', 'telefone', 'canal', 'nota', 'respondido_em', 'enviada_por', 'conversationId'];
  const rows = data.recent.map((r) => [
    r.contactName || '',
    r.contactPhone || '',
    r.channelName || '',
    String(r.score),
    r.respondedAt,
    r.sentByName || '',
    r.conversationId,
  ]);
  const esc = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((line) => line.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pesquisa-satisfacao-${data.periodDays}d.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StarRow({ filled, size = 'md' }: { filled: number; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'text-base leading-none' : 'text-xl sm:text-2xl leading-none';
  return (
    <div className={`flex justify-center gap-0.5 ${cls} ${neon.text}`} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= filled ? 'opacity-100' : 'opacity-[0.22]'}>
          ★
        </span>
      ))}
    </div>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, open: 0, waiting: 0, closed: 0 });
  const [ceapdeskEnabled, setCeapdeskEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [surveyStats, setSurveyStats] = useState<SatisfactionStatsResponse | null>(null);
  const [perfStats, setPerfStats] = useState<DashboardPerformancePayload | null>(null);
  const [periodLoading, setPeriodLoading] = useState(true);
  const [surveyUpdatedAt, setSurveyUpdatedAt] = useState<Date | null>(null);
  /** Seção Operação: métricas vindas do CEAPDesk ou fallback local (ex.: CEAPDesk indisponível). */
  const [operacaoFonte, setOperacaoFonte] = useState<'ceapdesk' | 'local' | null>(null);

  const [convMetrics, setConvMetrics] = useState<ConversationDashboardMetrics | null>(null);
  const [convMetricsLoading, setConvMetricsLoading] = useState(true);
  /** Filtros globais: um conjunto aplicado em todos os blocos do dashboard. */
  const [globalDays, setGlobalDays] = useState(30);
  const [globalChannelId, setGlobalChannelId] = useState('');
  const [globalSectorId, setGlobalSectorId] = useState('');
  const [channelOptions, setChannelOptions] = useState<{ id: string; name: string }[]>([]);
  const [sectorOptions, setSectorOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [chRes, secRes] = await Promise.all([
          api.get<{ id: string; name: string }[]>('/api/channels'),
          api.get<{ id: string; name: string }[]>('/api/sectors?includeInactive=true'),
        ]);
        if (!cancelled) {
          setChannelOptions(Array.isArray(chRes.data) ? chRes.data : []);
          setSectorOptions(Array.isArray(secRes.data) ? secRes.data : []);
        }
      } catch (e) {
        console.error('[Dashboard] Falha ao carregar canais/setores para filtros:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params: Record<string, string> = {};
        params.days = String(globalDays);
        if (globalChannelId) params.channelId = globalChannelId;
        if (globalSectorId) params.sectorId = globalSectorId;
        setConvMetricsLoading(true);
        const res = await api.get<ConversationDashboardMetrics>('/api/conversations/dashboard-conversation-metrics', {
          params,
        });
        if (!cancelled) setConvMetrics(res.data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setConvMetrics(null);
      } finally {
        if (!cancelled) setConvMetricsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [globalDays, globalChannelId, globalSectorId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const en = await api.get<{ enabled: boolean }>('/api/external-dashboard/enabled');
        if (cancelled) return;
        setCeapdeskEnabled(!!en.data?.enabled);
      } catch (e) {
        console.error(e);
        if (!cancelled) setCeapdeskEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ceapdeskEnabled === null) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const commonParams: Record<string, string> = {
        days: String(globalDays),
      };
      if (globalChannelId) commonParams.channelId = globalChannelId;
      if (globalSectorId) commonParams.sectorId = globalSectorId;
      try {
        if (ceapdeskEnabled) {
          try {
            const s = await api.get<Record<string, unknown>>('/api/external-dashboard/stats', {
              params: {
                periodo: periodoFromDays(globalDays),
                ...commonParams,
              },
            });
            if (!cancelled) setStats(mapCeapdeskStatsToCards(s.data));
          } catch (err) {
            console.error('[Dashboard] CEAPDesk stats indisponível, usando conversas locais:', err);
            const response = await api.get<ConversationDashboardMetrics>(
              '/api/conversations/dashboard-conversation-metrics',
              { params: commonParams },
            );
            if (!cancelled) {
              setCeapdeskEnabled(false);
              setStats({
                total: response.data.total,
                open: response.data.open,
                waiting: response.data.waiting,
                closed: response.data.closed,
              });
            }
          }
        } else {
          const response = await api.get<ConversationDashboardMetrics>(
            '/api/conversations/dashboard-conversation-metrics',
            { params: commonParams },
          );
          if (!cancelled) {
            setStats({
              total: response.data.total,
              open: response.data.open,
              waiting: response.data.waiting,
              closed: response.data.closed,
            });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ceapdeskEnabled, globalDays, globalChannelId, globalSectorId]);

  useEffect(() => {
    if (ceapdeskEnabled === null) return;

    let cancelled = false;
    (async () => {
      setPeriodLoading(true);
      setOperacaoFonte(null);
      try {
        const commonParams: Record<string, string> = { days: String(globalDays) };
        if (globalChannelId) commonParams.channelId = globalChannelId;
        if (globalSectorId) commonParams.sectorId = globalSectorId;
        const surveyRes = await api.get<SatisfactionStatsResponse>('/api/conversations/satisfaction-survey-stats', {
          params: commonParams,
        });
        if (cancelled) return;
        setSurveyStats(surveyRes.data);

        if (ceapdeskEnabled) {
          try {
            const periodo = periodoFromDays(globalDays);
            const [completoRes, usuariosRes] = await Promise.all([
              api.get<unknown>('/api/external-dashboard/dashboard-completo', {
                params: { periodo, ...commonParams },
              }),
              api.get<unknown>('/api/external-dashboard/usuarios-performance', {
                params: { periodo, ...commonParams },
              }),
            ]);
            if (!cancelled) {
              setPerfStats(buildPerfFromCeapdesk(completoRes.data, usuariosRes.data, globalDays));
              setOperacaoFonte('ceapdesk');
            }
          } catch (perfErr) {
            console.error('[Dashboard] CEAPDesk operação indisponível, usando métricas locais:', perfErr);
            const perfRes = await api.get<DashboardPerformancePayload>('/api/conversations/dashboard-performance', {
              params: commonParams,
            });
            if (!cancelled) {
              setPerfStats(perfRes.data);
              setOperacaoFonte('local');
            }
          }
        } else {
          const perfRes = await api.get<DashboardPerformancePayload>('/api/conversations/dashboard-performance', {
            params: commonParams,
          });
          if (!cancelled) {
            setPerfStats(perfRes.data);
            setOperacaoFonte('local');
          }
        }
        if (!cancelled) setSurveyUpdatedAt(new Date());
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setSurveyStats(null);
          setPerfStats(null);
        }
      } finally {
        if (!cancelled) setPeriodLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [globalDays, globalChannelId, globalSectorId, ceapdeskEnabled]);

  const periodBlockLoading = periodLoading || ceapdeskEnabled === null;

  const maxDist = useMemo(() => {
    const dist = surveyStats?.summary.distribution;
    if (!dist) return 1;
    return Math.max(1, ...[1, 2, 3, 4, 5].map((n) => dist[n] ?? 0));
  }, [surveyStats]);

  const completed = surveyStats?.summary.completedInPeriod ?? 0;
  const avgRounded =
    surveyStats?.summary.averageScore != null ? Math.round(surveyStats.summary.averageScore) : 0;

  const liveInsightLabel = 'LIVE INSIGHT';
  const updatedLabel =
    surveyUpdatedAt && Date.now() - surveyUpdatedAt.getTime() < 120_000
      ? 'Atualizado agora'
      : surveyUpdatedAt
        ? `Atualizado ${surveyUpdatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : '';

  return (
    <div className="min-h-full bg-[#0e100e] px-4 py-6 font-body text-[#e8ece9] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="font-headline text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#9ca3a0]">Visão geral do atendimento</p>
        </header>

        <section className={`mb-8 rounded-2xl border p-4 sm:p-5 ${neon.panel}`}>
          <div className="mb-3">
            <h2 className="font-headline text-lg font-bold text-white sm:text-xl">Filtros globais</h2>
            <p className="mt-1 text-xs text-[#8b9490]">
              Os filtros abaixo valem para conversas, operação, pesquisa e resumo externo.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[150px] flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[#8b9490]">Período</label>
              <select
                value={String(globalDays)}
                onChange={(e) => setGlobalDays(Number(e.target.value))}
                className={`rounded-lg border px-3 py-2 text-xs font-medium text-[#e8ece9] outline-none ${neon.card} focus:border-[#4ade80]/50`}
              >
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
              </select>
            </div>
            <div className="flex min-w-[170px] flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[#8b9490]">Canal</label>
              <select
                value={globalChannelId}
                onChange={(e) => setGlobalChannelId(e.target.value)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium text-[#e8ece9] outline-none ${neon.card} focus:border-[#4ade80]/50`}
              >
                <option value="">Todos</option>
                {channelOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[170px] flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[#8b9490]">Setor</label>
              <select
                value={globalSectorId}
                onChange={(e) => setGlobalSectorId(e.target.value)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium text-[#e8ece9] outline-none ${neon.card} focus:border-[#4ade80]/50`}
              >
                <option value="">Todos</option>
                {sectorOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="mt-10 border-t border-[#252b28] pt-10">
          <div className="mb-4">
            <h2 className="font-headline text-lg font-bold text-white sm:text-xl">Conversas (sistema chat)</h2>
            <p className="mt-1 max-w-3xl text-xs text-[#8b9490]">
              Métricas locais: abertas, em fila (aguardando atendimento), fechadas, sessão ativa com o bot e
              fechadas sem handoff humano. Use os filtros para recortar por canal, setor ou conversas criadas no
              período.
            </p>
          </div>

          {convMetricsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className={`h-[100px] animate-pulse rounded-xl border ${neon.card}`} />
              ))}
            </div>
          ) : convMetrics ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <RefStatCard
                title="TOTAL"
                value={convMetrics.total}
                trend="+0%"
                icon="💬"
                barActive={convMetrics.total > 0}
              />
              <RefStatCard
                title="ABERTAS"
                value={convMetrics.open}
                trend="+0%"
                icon="🟢"
                barActive={convMetrics.open > 0}
              />
              <RefStatCard
                title="EM FILA"
                value={convMetrics.waiting}
                trend="+0%"
                icon="⏳"
                barActive={convMetrics.waiting > 0}
              />
              <RefStatCard
                title="FECHADAS"
                value={convMetrics.closed}
                trend="+0%"
                icon="✓"
                barActive={convMetrics.closed > 0}
              />
              <RefStatCard
                title="NO BOT"
                value={convMetrics.inBot}
                trend="+0%"
                icon="🤖"
                barActive={convMetrics.inBot > 0}
              />
              <RefStatCard
                title="FIM NO BOT"
                value={convMetrics.finishedByBot}
                trend="+0%"
                icon="🛑"
                barActive={convMetrics.finishedByBot > 0}
              />
            </div>
          ) : (
            <p className="text-sm text-[#6b7280]">Não foi possível carregar as métricas de conversas.</p>
          )}
        </section>

        <section className="mt-8">
          <div className={`rounded-2xl border p-5 sm:p-6 ${neon.panel}`}>
            <h2 className="font-headline text-lg font-bold text-white sm:text-xl">Resumo integrado</h2>
            <p className="mt-1 text-xs text-[#8b9490]">
              {ceapdeskEnabled
                ? 'Visão do CEAPDesk no mesmo recorte global.'
                : 'Visão local do sistema no mesmo recorte global.'}
            </p>
            {loading ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-[120px] animate-pulse rounded-xl border ${neon.card}`} />
                ))}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <RefStatCard
                  title={ceapdeskEnabled ? 'TOTAL DE TICKETS' : 'TOTAL'}
                  value={stats.total}
                  trend="+0%"
                  icon="💬"
                  barActive={stats.total > 0}
                />
                <RefStatCard
                  title={ceapdeskEnabled ? 'ABERTOS' : 'ABERTAS'}
                  value={stats.open}
                  trend="+0%"
                  icon="🚩"
                  barActive={stats.open > 0}
                />
                <RefStatCard
                  title="EM FILA"
                  value={stats.waiting}
                  icon="📋"
                  barActive={stats.waiting > 0}
                />
                <RefStatCard
                  title={ceapdeskEnabled ? 'FECHADOS' : 'FECHADAS'}
                  value={stats.closed}
                  icon="✓"
                  barActive={stats.closed > 0}
                />
              </div>
            )}
          </div>
        </section>

        {/* Tempo de atendimento + performance de usuários */}
        <section className="mt-8">
          <div
            className={`rounded-2xl border p-5 sm:p-6 ${neon.panel}`}
            style={{ boxShadow: '0 0 0 1px rgba(74, 222, 128, 0.05), 0 16px 40px rgba(0,0,0,0.28)' }}
          >
            <h2 className="font-headline text-lg font-bold text-white sm:text-xl">Operação</h2>
            <p className="mt-1 text-xs text-[#8b9490]">
              {periodBlockLoading
                ? ceapdeskEnabled
                  ? 'Carregando indicadores de operação (CEAPDesk ou fallback local)...'
                  : 'Carregando métricas de operação...'
                : operacaoFonte === 'ceapdesk'
                  ? 'Indicadores do CEAPDesk (tickets). A tabela usa performance por usuário no período.'
                  : ceapdeskEnabled && operacaoFonte === 'local'
                    ? 'Os cards no topo vêm do CEAPDesk; esta seção usa métricas locais (fallback).'
                    : 'Tempo de atendimento e volume de mensagens por atendente no período.'}
            </p>
            {periodBlockLoading ? (
              <div className="mt-5 grid animate-pulse gap-4 lg:grid-cols-2">
                <div className={`h-40 rounded-xl border ${neon.card}`} />
                <div className={`h-40 rounded-xl border ${neon.card}`} />
              </div>
            ) : perfStats ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div className={`rounded-xl border p-4 sm:p-5 ${neon.card}`}>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b9490]">
                    Tempo de atendimento
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#2a322c] border-l-[3px] border-l-[#22c55e] bg-[#141816] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#8b9490]">
                        1ª resposta humana
                      </p>
                      <p className="mt-1 font-headline text-2xl font-bold text-white">
                        {formatDurationMinutes(perfStats.tempo.avgFirstResponseMinutes)}
                      </p>
                      <p className="mt-2 text-[10px] leading-snug text-[#6b7280]">
                        Média entre primeira mensagem do cliente e primeira resposta do time (sem bot).{' '}
                        {perfStats.tempo.firstResponseSampleSize > 0
                          ? `Base: ${perfStats.tempo.firstResponseSampleSize} conversa(s) criada(s) no período.`
                          : 'Sem amostras no período.'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#2a322c] bg-[#141816] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#8b9490]">
                        {operacaoFonte === 'ceapdesk' ? 'Tickets fechados' : 'Conversas fechadas'}
                      </p>
                      <p className="mt-1 font-headline text-2xl font-bold text-white">
                        {formatDurationMinutes(perfStats.tempo.avgClosedConversationMinutes)}
                      </p>
                      <p className="mt-2 text-[10px] leading-snug text-[#6b7280]">
                        {operacaoFonte === 'ceapdesk'
                          ? 'Tempo médio de resolução conforme SLA / métricas do CEAPDesk no período.'
                          : 'Tempo médio entre criação e última atualização em conversas com status fechado atualizadas no período (aproximação de duração).'}
                        {perfStats.tempo.closedConversationsSampleSize > 0
                          ? ` Base: ${perfStats.tempo.closedConversationsSampleSize}.`
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
                <div className={`rounded-xl border p-4 sm:p-5 ${neon.card}`}>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b9490]">
                    Performance de usuários
                  </h3>
                  <div className="mt-3 max-h-[280px] overflow-auto rounded-lg border border-[#2a322c]">
                    <table className="w-full min-w-[280px] text-left text-xs">
                      <thead className="sticky top-0 bg-[#1a1f1c] text-[10px] font-bold uppercase tracking-wide text-[#8b9490]">
                        <tr>
                          <th className="px-3 py-2">Atendente</th>
                          <th className="px-3 py-2 text-right">Msgs</th>
                          <th className="px-3 py-2 text-right">
                            {operacaoFonte === 'ceapdesk' ? 'Tickets' : 'Conversas'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#252b28] text-[#e8ece9]">
                        {perfStats.usuarios.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-3 py-8 text-center text-[#6b7280]">
                              Nenhuma mensagem humana no período.
                            </td>
                          </tr>
                        ) : (
                          perfStats.usuarios.map((u, idx) => (
                            <tr key={u.userId} className="hover:bg-[#141816]/80">
                              <td className="px-3 py-2.5">
                                <span className="mr-2 inline-flex w-5 justify-center font-mono text-[#6b7280]">
                                  {idx + 1}
                                </span>
                                <span className="font-medium text-white">{u.name}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-[#86efac]">
                                {u.messagesSent}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{u.conversationsTouched}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[10px] text-[#6b7280]">
                    {operacaoFonte === 'ceapdesk'
                      ? 'Dados agregados do CEAPDesk no período selecionado.'
                      : 'Mensagens enviadas pelo app (exclui bot). Conversas = distintas com ao menos uma mensagem sua no período.'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#6b7280]">Não foi possível carregar as métricas de operação.</p>
            )}
          </div>
        </section>

        {/* Bloco principal — fiel ao mock */}
        <section className="mt-10 sm:mt-12">
          <div
            className={`rounded-2xl border p-5 sm:p-6 lg:p-8 ${neon.panel}`}
            style={{ boxShadow: '0 0 0 1px rgba(74, 222, 128, 0.06), 0 24px 48px rgba(0,0,0,0.35)' }}
          >
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-headline text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Pesquisa de Satisfação
                </h2>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${neon.textMuted} ${neon.ring}`}
                  style={{ background: 'rgba(34, 197, 94, 0.08)' }}
                >
                  {liveInsightLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  disabled={!surveyStats || surveyStats.recent.length === 0}
                  onClick={() => surveyStats && exportSurveyCsv(surveyStats)}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition disabled:opacity-40 ${neon.btnOutline}`}
                >
                  Exportar Dados
                </button>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('ref-satisfacao-grid')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }
                  className={`rounded-lg px-4 py-2 text-xs font-bold shadow-lg transition ${neon.btnSolid}`}
                >
                  Ver Detalhes
                </button>
              </div>
            </div>

            {periodBlockLoading ? (
              <div className="grid min-h-[260px] animate-pulse grid-cols-1 gap-4 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`rounded-xl border ${neon.card} min-h-[200px]`} />
                ))}
              </div>
            ) : surveyStats ? (
              <div id="ref-satisfacao-grid" className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Coluna 1 — Indicadores */}
                <div className={`flex flex-col gap-5 rounded-xl border p-5 ${neon.card}`}>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b9490]">
                    INDICADORES ({surveyStats.periodDays} DIAS)
                  </h3>
                  <div
                    className={`rounded-xl border px-5 py-8 text-center ${neon.card}`}
                    style={{ background: 'linear-gradient(180deg, #1e2420 0%, #161916 100%)' }}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8b9490]">
                      MÉDIA DAS NOTAS
                    </p>
                    <p className="mt-2 font-headline text-5xl font-bold tracking-tight text-white sm:text-6xl">
                      {surveyStats.summary.averageScore != null
                        ? `${surveyStats.summary.averageScore}`
                        : '—'}
                      <span className="text-2xl font-semibold text-[#8b9490]">/5</span>
                    </p>
                    <div className="mt-4">
                      {surveyStats.summary.averageScore != null ? (
                        <StarRow filled={avgRounded} />
                      ) : (
                        <StarRow filled={0} />
                      )}
                    </div>
                    {surveyStats.summary.averageScore == null && completed === 0 ? (
                      <p className="mt-3 text-center text-xs text-[#6b7280]">Sem respostas no período</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <RefMiniKpi accent label="RESPOSTAS" value={surveyStats.summary.completedInPeriod} />
                    <RefMiniKpi label="ENVIADAS" value={surveyStats.summary.sentInPeriod} />
                    <RefMiniKpi
                      label="TAXA"
                      value={
                        surveyStats.summary.responseRatePercent != null
                          ? `${surveyStats.summary.responseRatePercent}%`
                          : '—'
                      }
                    />
                    <RefMiniKpi label="PENDENTES" value={surveyStats.summary.pendingTotal} />
                  </div>
                </div>

                {/* Coluna 2 — Distribuição */}
                <div className={`flex flex-col rounded-xl border p-5 ${neon.card}`}>
                  <h3 className="mb-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b9490]">
                    DISTRIBUIÇÃO
                  </h3>
                  <div className="flex flex-1 flex-col justify-center space-y-4">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const count = surveyStats.summary.distribution[n] ?? 0;
                      const barPct = Math.round((count / maxDist) * 100);
                      const sharePct =
                        completed > 0 ? Math.round((count / completed) * 1000) / 10 : 0;
                      const label =
                        n === 1 ? '1 ESTRELA' : `${n} ESTRELAS`;
                      return (
                        <div key={n} className="flex items-center gap-3">
                          <span className="w-[5.5rem] shrink-0 text-[11px] font-bold uppercase tracking-wide text-[#b8c4be]">
                            {label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className={`h-2 overflow-hidden rounded-full ${neon.barDim}`}>
                              <motion.div
                                className={`h-full rounded-full ${neon.bar}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${barPct}%` }}
                                transition={{ duration: 0.45, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                          <span className="w-12 shrink-0 text-right text-xs font-bold tabular-nums text-white">
                            {sharePct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Coluna 3 — Últimas respostas */}
                <div className={`flex flex-col rounded-xl border p-5 ${neon.card}`}>
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b9490]">
                      ÚLTIMAS RESPOSTAS
                    </h3>
                    {updatedLabel ? (
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${neon.textMuted}`}>
                        {updatedLabel}
                      </span>
                    ) : null}
                  </div>
                  <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 conv-no-scrollbar">
                    {surveyStats.recent.length === 0 ? (
                      <li className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#2f3834] py-14 text-center">
                        <span className="text-3xl opacity-40 grayscale">📦</span>
                        <span className="text-sm text-[#6b7280]">Aguardando novos feedbacks...</span>
                      </li>
                    ) : (
                      surveyStats.recent.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-xl border border-[#2a322c] bg-[#141816] p-4 transition hover:border-[#3f5248]"
                        >
                          <div className="flex gap-3">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#052e16] ${neon.bar}`}
                            >
                              {initialFromName(r.contactName, r.contactPhone)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <span className="truncate font-semibold text-white">
                                  {r.contactName || r.contactPhone || 'Contato'}
                                </span>
                                <Link
                                  to={`/conversations?c=${encodeURIComponent(r.conversationId)}`}
                                  className={`flex shrink-0 items-center gap-1 text-xs font-bold ${neon.text} hover:underline`}
                                >
                                  Ver na conversa
                                  <ExternalLinkIcon className="opacity-90" />
                                </Link>
                              </div>
                              <div className="mt-1">
                                <StarRow filled={r.score} size="sm" />
                              </div>
                              <p className="mt-2 text-[12px] text-[#9ca3a0]">
                                {formatRespondedLabel(r.respondedAt)}
                                {r.channelName ? (
                                  <>
                                    <br />
                                    <span className={neon.textMuted}>
                                      Canal: {r.channelName}
                                    </span>
                                    <span className={`ml-1 inline ${neon.text}`}>✓</span>
                                  </>
                                ) : null}
                              </p>
                              {r.sentByName ? (
                                <p className="mt-1 text-[10px] text-[#6b7280]">
                                  Enviada por {r.sentByName}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-[#6b7280]">
                Não foi possível carregar os dados da pesquisa.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Card KPI topo — mock: valor, +0% verde nos dois primeiros, barra verde ou cinza */
function RefStatCard({
  title,
  value,
  trend,
  icon,
  barActive,
}: {
  title: string;
  value: number;
  trend?: string;
  icon: string;
  barActive: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 sm:p-5 ${neon.card}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b9490]">
            {title}
          </h3>
          <p className="mt-2 font-headline text-3xl font-bold tabular-nums text-white">{value}</p>
          {trend ? (
            <p className={`mt-1 text-[11px] font-semibold ${neon.text}`}>{trend}</p>
          ) : null}
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(74, 222, 128, 0.2)' }}
        >
          {icon}
        </div>
      </div>
      <div
        className={`mt-4 h-1 rounded-full ${barActive ? neon.bar : 'bg-[#252b28]'}`}
        title={barActive ? undefined : 'Sem movimento no indicador'}
      />
    </motion.div>
  );
}

/** Mini KPI — RESPOSTAS com barra vertical verde à esquerda (mock) */
function RefMiniKpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-[#2a322c] bg-[#141816] px-3 py-3 ${
        accent ? 'border-l-[3px] border-l-[#22c55e]' : ''
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#8b9490]">{label}</p>
      <p className="mt-1 font-headline text-xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}
