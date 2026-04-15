import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { motion } from 'framer-motion';

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

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    waiting: 0,
    closed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [surveyDays, setSurveyDays] = useState(30);
  const [surveyStats, setSurveyStats] = useState<SatisfactionStatsResponse | null>(null);
  const [surveyLoading, setSurveyLoading] = useState(true);
  const [surveyUpdatedAt, setSurveyUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/api/conversations/stats');
        setStats(response.data);
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const loadSurvey = async () => {
      setSurveyLoading(true);
      try {
        const { data } = await api.get<SatisfactionStatsResponse>(
          '/api/conversations/satisfaction-survey-stats',
          { params: { days: surveyDays } },
        );
        setSurveyStats(data);
        setSurveyUpdatedAt(new Date());
      } catch (e) {
        console.error('Erro ao carregar pesquisa de satisfação:', e);
        setSurveyStats(null);
      } finally {
        setSurveyLoading(false);
      }
    };
    loadSurvey();
  }, [surveyDays]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const maxDist = useMemo(() => {
    const dist = surveyStats?.summary.distribution;
    if (!dist) return 1;
    return Math.max(1, ...[1, 2, 3, 4, 5].map((n) => dist[n] ?? 0));
  }, [surveyStats]);

  const completed = surveyStats?.summary.completedInPeriod ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 font-body text-on-surface sm:px-6 sm:py-8">
      <motion.header
        className="mb-8"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
          Dashboard
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-on-surface-variant">
          Visão geral do atendimento e da pesquisa de satisfação (notas de 1 a 5 estrelas).
        </p>
      </motion.header>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-primary/10 bg-surface-container-highest/40 p-5"
            >
              <div className="mb-3 h-3 w-24 rounded bg-surface-variant" />
              <div className="h-9 w-14 rounded bg-surface-variant" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <StatCard
            title="Total de conversas"
            value={stats.total}
            subtitle="Cadastradas no sistema"
            icon="💬"
            delay={0}
            barWidth={stats.total > 0 ? 100 : 12}
          />
          <StatCard
            title="Abertas"
            value={stats.open}
            subtitle="Em atendimento"
            icon="🚩"
            delay={0.06}
            barWidth={stats.total > 0 ? Math.min(100, Math.round((stats.open / stats.total) * 100)) : 0}
          />
          <StatCard
            title="Aguardando"
            value={stats.waiting}
            subtitle="Na fila"
            icon="📋"
            delay={0.12}
            barWidth={stats.total > 0 ? Math.min(100, Math.round((stats.waiting / stats.total) * 100)) : 0}
          />
          <StatCard
            title="Fechadas"
            value={stats.closed}
            subtitle="Encerradas"
            icon="✓"
            delay={0.18}
            barWidth={stats.total > 0 ? Math.min(100, Math.round((stats.closed / stats.total) * 100)) : 0}
          />
        </motion.div>
      )}

      <motion.section
        id="satisfacao-detail"
        className="mt-10 sm:mt-12"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="rounded-2xl border border-primary/15 bg-surface-container-low/60 p-1 shadow-forest-glow backdrop-blur-sm">
          <div className="rounded-xl border border-primary/10 bg-surface-container-highest/50 p-5 sm:p-6">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-headline text-xl font-bold text-on-surface sm:text-2xl">
                  Pesquisa de satisfação
                </h2>
                <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-fixed-dim">
                  Tempo real
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span className="hidden sm:inline">Período</span>
                  <select
                    value={surveyDays}
                    onChange={(e) => setSurveyDays(Number(e.target.value))}
                    className="rounded-lg border border-primary/20 bg-surface-container-lowest px-3 py-2 text-sm font-medium text-on-surface outline-none ring-primary/20 focus:ring-2"
                  >
                    <option value={7}>7 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={90}>90 dias</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!surveyStats || surveyStats.recent.length === 0}
                  onClick={() => surveyStats && exportSurveyCsv(surveyStats)}
                  className="rounded-lg border border-primary/25 px-3 py-2 text-xs font-semibold text-primary-fixed-dim transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Exportar dados
                </button>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('satisfacao-grid')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary shadow-emerald-send transition hover:bg-primary/90"
                >
                  Ver detalhes
                </button>
              </div>
            </div>

            {surveyLoading ? (
              <div className="grid min-h-[280px] animate-pulse grid-cols-1 gap-4 rounded-xl border border-primary/10 bg-surface-container-low/40 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl bg-surface-container-highest/30 p-4" />
                ))}
              </div>
            ) : surveyStats ? (
              <div id="satisfacao-grid" className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
                {/* Indicadores */}
                <div className="flex flex-col gap-4 rounded-xl border border-primary/10 bg-surface-container-low/40 p-4 sm:p-5">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Indicadores ({surveyStats.periodDays} dias)
                  </h3>
                  <div className="rounded-xl border border-primary/15 bg-surface-container-highest/60 px-4 py-5 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                      Média das notas
                    </p>
                    <p className="mt-1 font-headline text-4xl font-bold text-on-surface sm:text-5xl">
                      {surveyStats.summary.averageScore != null
                        ? `${surveyStats.summary.averageScore}`
                        : '—'}
                      <span className="text-lg font-semibold text-on-surface-variant">/5</span>
                    </p>
                    <div className="mt-3 flex justify-center gap-0.5 text-primary" aria-hidden>
                      {surveyStats.summary.averageScore != null
                        ? Array.from({ length: 5 }, (_, i) => (
                            <span
                              key={i}
                              className={
                                i < Math.round(surveyStats.summary.averageScore!)
                                  ? 'opacity-100'
                                  : 'opacity-25'
                              }
                            >
                              ★
                            </span>
                          ))
                        : Array.from({ length: 5 }, (_, i) => (
                            <span key={i} className="text-on-surface-variant opacity-20">
                              ★
                            </span>
                          ))}
                    </div>
                    {surveyStats.summary.averageScore == null && completed === 0 ? (
                      <p className="mt-2 text-center text-[11px] text-on-surface-variant">
                        Nenhuma resposta no período
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniMetric accent label="Respostas" value={surveyStats.summary.completedInPeriod} />
                    <MiniMetric label="Enviadas" value={surveyStats.summary.sentInPeriod} />
                    <MiniMetric
                      label="Taxa"
                      value={
                        surveyStats.summary.responseRatePercent != null
                          ? `${surveyStats.summary.responseRatePercent}%`
                          : '—'
                      }
                    />
                    <MiniMetric label="Pendentes" value={surveyStats.summary.pendingTotal} warn />
                  </div>
                </div>

                {/* Distribuição */}
                <div className="rounded-xl border border-primary/10 bg-surface-container-low/40 p-4 sm:p-5">
                  <h3 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Distribuição
                  </h3>
                  <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const count = surveyStats.summary.distribution[n] ?? 0;
                      const barPct = Math.round((count / maxDist) * 100);
                      const sharePct =
                        completed > 0 ? Math.round((count / completed) * 1000) / 10 : 0;
                      return (
                        <div key={n} className="flex items-center gap-3">
                          <span className="w-[4.5rem] shrink-0 text-xs font-medium text-on-surface-variant">
                            {n} estrela{n > 1 ? 's' : ''}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="h-2 overflow-hidden rounded-full bg-surface-variant/80">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                                initial={{ width: 0 }}
                                animate={{ width: `${barPct}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-on-surface">
                            {sharePct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Últimas respostas */}
                <div className="rounded-xl border border-primary/10 bg-surface-container-low/40 p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Últimas respostas
                    </h3>
                    {surveyUpdatedAt && (
                      <span className="text-[10px] font-medium text-primary-fixed-dim">
                        Atualizado {surveyUpdatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1 conv-no-scrollbar">
                    {surveyStats.recent.length === 0 ? (
                      <li className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary/20 bg-surface-container-highest/30 py-10 text-center text-sm text-on-surface-variant">
                        <span className="text-2xl opacity-50">📭</span>
                        Aguardando novos feedbacks…
                      </li>
                    ) : (
                      surveyStats.recent.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-xl border border-primary/10 bg-surface-container-highest/50 p-3 transition hover:border-primary/25"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary-fixed-dim ring-1 ring-primary/20">
                              {initialFromName(r.contactName, r.contactPhone)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="truncate font-semibold text-on-surface">
                                  {r.contactName || r.contactPhone || 'Contato'}
                                </span>
                                <Link
                                  to={`/conversations/${r.conversationId}`}
                                  className="shrink-0 text-xs font-bold text-primary hover:underline"
                                >
                                  Ver conversa ↗
                                </Link>
                              </div>
                              <div className="mt-0.5 text-sm text-primary" aria-label={`Nota ${r.score} de 5`}>
                                {'★'.repeat(r.score)}
                                <span className="ml-1 text-[11px] font-normal text-on-surface-variant">
                                  ({r.score}/5)
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-on-surface-variant">
                                {formatRespondedLabel(r.respondedAt)}
                                {r.channelName ? (
                                  <>
                                    {' · '}
                                    <span className="text-primary-fixed-dim">Canal: {r.channelName}</span>
                                    <span className="ml-1 text-primary">✓</span>
                                  </>
                                ) : null}
                              </p>
                              {r.sentByName ? (
                                <p className="mt-0.5 text-[10px] text-on-surface-variant/80">
                                  Pesquisa enviada por {r.sentByName}
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
              <p className="py-8 text-center text-sm text-on-surface-variant">
                Não foi possível carregar os dados da pesquisa.
              </p>
            )}
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  delay = 0,
  barWidth,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon?: string;
  delay?: number;
  barWidth: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -2 }}
      className="group rounded-2xl border border-primary/10 bg-surface-container-highest/55 p-5 shadow-forest-glow transition hover:border-primary/25 hover:bg-surface-container-highest/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            {title}
          </h3>
          <p className="mt-2 font-headline text-3xl font-bold tabular-nums text-on-surface">{value}</p>
          {subtitle ? (
            <p className="mt-1 text-[11px] font-medium text-primary-fixed-dim">{subtitle}</p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-lg ring-1 ring-primary/20 transition group-hover:bg-primary/25">
            {icon}
          </div>
        ) : null}
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-variant/60">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(8, Math.min(100, barWidth))}%` }}
          transition={{ duration: 0.7, delay: delay + 0.15, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

function MiniMetric({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        accent
          ? 'border-primary/30 bg-primary/10'
          : warn
            ? 'border-amber-500/25 bg-amber-500/5'
            : 'border-primary/10 bg-surface-container-highest/40'
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p
        className={`mt-0.5 font-headline text-lg font-bold tabular-nums ${
          warn ? 'text-amber-200' : 'text-on-surface'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
