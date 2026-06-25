import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthProvider';
import { useTaskNotificationListener } from '../contexts/SocketProvider';
import { SidebarLink } from './ui/SidebarLink';
import { SidebarDropdownLink } from './ui/SidebarDropdownLink';
import { Button } from './ui/Button';

const HEARTBEAT_MS = 90_000;

export default function Layout() {
  const navigate = useNavigate();
  const {
    user,
    pause,
    isPauseLoading,
    logout,
    applyPause,
  } = useAuth();

  const isPaused = pause?.isPaused ?? false;
  const pauseReason = pause?.pauseReason ?? null;
  const openAssignedConversationsCount = pause?.openAssignedConversationsCount ?? 0;

  const [showPauseModal, setShowPauseModal] = useState(false);
  const [taskNotification, setTaskNotification] = useState<{
    conversationId: string;
    content: string;
  } | null>(null);

  useTaskNotificationListener((payload) => {
    setTaskNotification(payload);
  });

  useEffect(() => {
    if (!user) return;
    const ping = () => {
      void api.post('/api/auth/heartbeat').catch(() => {});
    };
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [user]);

  const userRole = user?.role;
  const isAdmin = userRole === 'ADMIN';
  const isSupervisorOrAdmin = userRole === 'ADMIN' || userRole === 'SUPERVISOR';

  const handlePauseClick = () => {
    if (isPaused) {
      void applyPause(false);
      setShowPauseModal(false);
      return;
    }
    if (openAssignedConversationsCount > 0) {
      const n = openAssignedConversationsCount;
      alert(
        n === 1
          ? 'Não é possível pausar: você tem 1 atendimento em aberto. Transfira, finalize ou arquive antes.'
          : `Não é possível pausar: você tem ${n} atendimentos em aberto. Transfira, finalize ou arquive antes.`,
      );
      return;
    }
    setShowPauseModal(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="flex h-screen bg-background font-body text-on-surface">
      <motion.aside
        className="relative z-10 flex w-64 flex-col bg-surface-container-lowest text-on-surface"
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <motion.div
          className="border-b border-primary/10 px-4 py-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-lg ring-1 ring-white/10">
              <img src="/ceape-bot.png" alt="Ceape chat" className="h-full w-full object-cover" />
            </div>
            <div>
              <h2 className="font-headline text-lg font-bold text-primary">Ceape chat</h2>
              <p className="text-[11px] font-medium text-primary/70">Atendimento e performance</p>
            </div>
          </div>
        </motion.div>

        <nav className="sidebar-scroll relative flex-1 space-y-1 overflow-y-auto overflow-x-visible p-3">
          <div className="mb-4">
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/50">
              Principal
            </p>
            <SidebarLink to="/dashboard" icon="📊">
              Dashboard
            </SidebarLink>
            <SidebarLink to="/conversations" icon="💬">
              Conversas
            </SidebarLink>
            <SidebarLink to="/tickets" icon="🎫">
              Tickets
            </SidebarLink>
          </div>

          <div className="mb-4">
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/50">
              Gestão
            </p>
            <SidebarDropdownLink
              icon="👥"
              label="Contatos"
              submenuTitle="CONTATOS E CONTAS"
              items={[
                ...(isSupervisorOrAdmin
                  ? [
                      { to: '/contacts/import', label: 'Importar Contatos', icon: '📥' },
                      { to: '/contacts/auto-created', label: 'Contatos', icon: '📋' },
                    ]
                  : []),
                { to: '/contact-lists', label: 'Listas', icon: '📋' },
              ]}
            />
            <SidebarLink to="/channels" icon="📡">
              Canais
            </SidebarLink>
            {isSupervisorOrAdmin && (
              <SidebarLink to="/journeys" icon="🧩">
                Jornadas
              </SidebarLink>
            )}
            <SidebarLink to="/calendario" icon="🗓️">
              Calendario
            </SidebarLink>
            <SidebarLink to="/templates" icon="🧾">
              Templates WhatsApp
            </SidebarLink>
          </div>

          <div className="mb-4">
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/50">
              Configurações
            </p>
            {isSupervisorOrAdmin && (
              <>
                <SidebarLink to="/users" icon="👤">
                  Usuários
                </SidebarLink>
                <SidebarLink to="/sectors" icon="🏢">
                  Setores
                </SidebarLink>
              </>
            )}
            {isAdmin && (
              <SidebarLink to="/audit-logs" icon="📜">
                Auditoria
              </SidebarLink>
            )}
            <SidebarLink to="/pipelines" icon="📈">
              Pipelines
            </SidebarLink>
            <SidebarLink to="/quick-replies" icon="⚡">
              Respostas Rápidas
            </SidebarLink>
            <SidebarLink to="/integrations" icon="🔌">
              Integrações
            </SidebarLink>
            <SidebarLink to="/bots" icon="🤖">
              Chatbots
            </SidebarLink>
          </div>
        </nav>

        <div className="space-y-3 border-t border-primary/10 bg-surface-container-low px-3 py-4">
          {user && (
            <div className="flex items-center gap-3 rounded-lg bg-surface-container-highest/70 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary-fixed-dim">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-on-surface">{user.name || 'Usuário'}</p>
                <p className="truncate text-xs text-on-surface-variant">{user.email}</p>
              </div>
            </div>
          )}

          {!isPauseLoading && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  variant={isPaused ? 'danger' : 'primary'}
                  onClick={handlePauseClick}
                  className="w-full"
                  disabled={!isPaused && openAssignedConversationsCount > 0}
                  title={
                    isPaused
                      ? 'Retomar atendimento'
                      : openAssignedConversationsCount > 0
                        ? `Pausa bloqueada: ${openAssignedConversationsCount} atendimento(s) em aberto.`
                        : 'Pausar atendimento'
                  }
                >
                  <span className="flex items-center justify-center gap-2">
                    {isPaused ? 'Indisponível' : 'Ativo'}
                  </span>
                </Button>
              </motion.div>

              {showPauseModal && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="fixed bottom-24 left-72 z-50"
                >
                  <div className="w-72 overflow-hidden rounded-xl border border-[rgba(63,73,69,0.2)] bg-surface-container-highest/95 shadow-forest-glow backdrop-blur-xl">
                    <div className="flex items-center justify-between border-b border-primary/10 bg-surface-container px-4 py-3">
                      <span className="text-sm font-semibold text-on-surface">Indisponível</span>
                      <button
                        type="button"
                        onClick={() => setShowPauseModal(false)}
                        className="text-xs text-on-surface-variant hover:text-on-surface"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="py-2">
                      {[
                        { label: 'Indisponível', icon: '🖥️' },
                        { label: 'Pausa almoço', icon: '🍽️' },
                        { label: 'Pausa particular', icon: '😍' },
                        { label: 'Problemas técnicos', icon: '🛠️' },
                        { label: 'Pausa feedback', icon: '💬' },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => {
                          void applyPause(true, opt.label).catch((error: unknown) => {
                            const msg =
                              (error as { response?: { data?: { error?: string } } })?.response?.data
                                ?.error || 'Erro ao alterar pausa';
                            alert(msg);
                          });
                          setShowPauseModal(false);
                        }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-on-surface-variant transition hover:bg-emerald-900/15 hover:text-on-surface"
                        >
                          <span className="text-lg">{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}

          {isPaused && pauseReason && (
            <motion.div
              className="rounded-lg border border-primary/20 bg-primary-container/30 p-3 text-center text-xs text-on-secondary-container"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {pauseReason}
            </motion.div>
          )}

          <Button
            variant="ghost"
            onClick={() => void handleLogout()}
            className="w-full text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
          >
            Sair
          </Button>
        </div>
      </motion.aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-surface">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>

      {taskNotification && (
        <div className="fixed bottom-6 right-6 z-[4000] max-w-[320px] rounded-xl border border-primary/20 bg-surface-container-highest/95 p-3.5 shadow-forest-glow backdrop-blur-xl">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-on-surface">Tarefa de pipeline</span>
            <button
              type="button"
              onClick={() => setTaskNotification(null)}
              className="cursor-pointer border-none bg-transparent text-sm text-on-surface-variant"
            >
              ✕
            </button>
          </div>
          <div className="whitespace-pre-wrap text-xs text-on-surface-variant">
            {taskNotification.content}
          </div>
        </div>
      )}
    </div>
  );
}
