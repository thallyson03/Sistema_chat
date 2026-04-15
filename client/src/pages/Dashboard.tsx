import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../components/ui/Card';

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
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const dist = surveyStats?.summary.distribution;
  const maxDist = dist
    ? Math.max(1, ...[1, 2, 3, 4, 5].map((n) => dist[n] ?? 0))
    : 1;

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="mb-2 text-4xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600">Visão geral do seu sistema de atendimento</p>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 h-4 w-20 rounded bg-slate-200" />
              <div className="h-10 w-16 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <StatCard
            title="Total de Conversas"
            value={stats.total}
            icon="📊"
            delay={0}
            gradient="from-blue-500 to-blue-600"
          />
          <StatCard
            title="Abertas"
            value={stats.open}
            icon="✅"
            delay={0.1}
            gradient="from-emerald-500 to-emerald-600"
          />
          <StatCard
            title="Aguardando"
            value={stats.waiting}
            icon="⏳"
            delay={0.2}
            gradient="from-amber-500 to-amber-600"
          />
          <StatCard
            title="Fechadas"
            value={stats.closed}
            icon="🔒"
            delay={0.3}
            gradient="from-slate-500 to-slate-600"
          />
        </motion.div>
      )}

      {/* Pesquisa de satisfação */}
      <motion.section
        className="mt-12"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Pesquisa de satisfação</h2>
            <p className="text-sm text-slate-600">
              Respostas de 1 a 5 estrelas no período selecionado (envios e respostas registrados no
              sistema).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase text-slate-500">Período</span>
            <select
              value={surveyDays}
              onChange={(e) => setSurveyDays(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none ring-amber-400/30 focus:ring-2"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </div>
        </div>

        {surveyLoading ? (
          <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
        ) : surveyStats ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="border-0 shadow-lg lg:col-span-1">
              <CardContent className="p-6">
                <div className="mb-4 h-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-600" />
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Indicadores ({surveyStats.periodDays} dias)
                </h3>
                <dl className="space-y-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-sm text-slate-600">Média das notas</dt>
                    <dd className="text-2xl font-bold text-amber-600">
                      {surveyStats.summary.averageScore != null
                        ? `${surveyStats.summary.averageScore} / 5`
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 text-sm">
                    <dt className="text-slate-600">Respostas no período</dt>
                    <dd className="font-semibold text-slate-900">
                      {surveyStats.summary.completedInPeriod}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 text-sm">
                    <dt className="text-slate-600">Pesquisas enviadas (período)</dt>
                    <dd className="font-semibold text-slate-900">
                      {surveyStats.summary.sentInPeriod}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 text-sm">
                    <dt className="text-slate-600">Taxa de resposta</dt>
                    <dd className="font-semibold text-slate-900">
                      {surveyStats.summary.responseRatePercent != null
                        ? `${surveyStats.summary.responseRatePercent}%`
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 text-sm">
                    <dt className="text-slate-600">Pendentes (aguardando cliente)</dt>
                    <dd className="font-semibold text-amber-800">
                      {surveyStats.summary.pendingTotal}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg lg:col-span-1">
              <CardContent className="p-6">
                <div className="mb-4 h-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-600" />
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Distribuição no período
                </h3>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const count = surveyStats.summary.distribution[n] ?? 0;
                    const pct = Math.round((count / maxDist) * 100);
                    return (
                      <div key={n} className="flex items-center gap-3">
                        <span className="w-16 shrink-0 text-sm font-medium text-slate-700">
                          {n} estrela{n > 1 ? 's' : ''}
                        </span>
                        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-sm font-semibold text-slate-800">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg lg:col-span-1">
              <CardContent className="p-6">
                <div className="mb-4 h-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-600" />
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Últimas respostas
                </h3>
                <p className="mb-3 text-xs text-slate-500">Até 20 registros mais recentes.</p>
                <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
                  {surveyStats.recent.length === 0 ? (
                    <li className="text-slate-500">Nenhuma resposta registrada ainda.</li>
                  ) : (
                    surveyStats.recent.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-col gap-0.5 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-base" title={`Nota ${r.score}`}>
                            {'⭐'.repeat(r.score)}
                          </span>
                          <Link
                            to={`/conversations/${r.conversationId}`}
                            className="shrink-0 text-xs font-semibold text-amber-700 underline-offset-2 hover:underline"
                          >
                            Ver conversa
                          </Link>
                        </div>
                        <span className="truncate text-xs text-slate-600">
                          {r.contactName || r.contactPhone || 'Contato'}
                          {r.channelName ? ` · ${r.channelName}` : ''}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(r.respondedAt).toLocaleString('pt-BR')}
                          {r.sentByName ? ` · enviada por ${r.sentByName}` : ''}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Não foi possível carregar os dados da pesquisa.</p>
        )}
      </motion.section>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  delay = 0,
  gradient,
}: {
  title: string;
  value: number;
  icon?: string;
  delay?: number;
  gradient: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{
        scale: 1.02,
        transition: { duration: 0.2 },
      }}
    >
      <Card className="card-hover overflow-hidden border-0 shadow-lg">
        <CardContent className="p-6">
          {/* Gradient Header */}
          <div className={`mb-4 -mx-6 -mt-6 h-1 bg-gradient-to-r ${gradient}`} />

          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-600">
                {title}
              </h3>
              <motion.p
                className={`bg-gradient-to-r ${gradient} bg-clip-text text-4xl font-bold text-transparent`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 15,
                  delay: delay + 0.2,
                }}
              >
                {value}
              </motion.p>
            </div>
            {icon && (
              <motion.div
                className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-2xl shadow-lg`}
                animate={{
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
              >
                {icon}
              </motion.div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((value / 100) * 100, 100)}%` }}
                transition={{ duration: 1, delay: delay + 0.3 }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
