import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion } from 'framer-motion';
import api from '../utils/api';

const HEARTBEAT_MS = 90_000;
import { getPublicApiOrigin } from '../config/publicUrl';
import { SidebarLink } from './ui/SidebarLink';
import { SidebarDropdownLink } from './ui/SidebarDropdownLink';
import { Button } from './ui/Button';

export default function Layout() {
  const navigate = useNavigate();
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [openAssignedConversationsCount, setOpenAssignedConversationsCount] = useState(0);
  const [loadingPause, setLoadingPause] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [taskNotification, setTaskNotification] = useState<{
    conversationId: string;
    content: string;
  } | null>(null);

  // Conexão global com Socket.IO para notificações de tarefa (vale para todo o sistema)
  useEffect(() => {
    const socket: Socket = io(getPublicApiOrigin(), {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[Layout] ✅ Conectado ao Socket.IO para notificações globais');
    });

    socket.on('new_message', async (data: { conversationId: string; messageId: string }) => {
      try {
        // Buscar apenas a última mensagem da conversa e verificar se é notificação de tarefa
        const response = await api.get(`/api/messages/conversation/${data.conversationId}`, {
          params: { limit: 1, offset: 0 },
        });
        const messages = response.data || [];
        if (!messages.length) return;

        const message = messages[messages.length - 1];

        const isTaskNotification =
          message?.metadata?.fromBot === true &&
          typeof message.content === 'string' &&
          message.content.startsWith('⏰ Chegou a hora de realizar uma tarefa deste negócio.');

        if (!isTaskNotification) return;

        setTaskNotification({
          conversationId: data.conversationId,
          content: message.content,
        });
      } catch (error) {
        console.error('[Layout] Erro ao processar new_message para notificação de tarefa:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Layout] ❌ Desconectado do Socket.IO (notificações globais)');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchPauseStatus();
    fetchUser();
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void fetchPauseStatus();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  /** Mantém presença “online” mesmo em telas com poucos requests HTTP. */
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    const ping = () => {
      void api.post('/api/auth/heartbeat').catch(() => {});
    };
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
    }
  };

  const fetchPauseStatus = async () => {
    try {
      const currentUserResponse = await api.get('/api/auth/me');
      const userId = currentUserResponse.data.id;

      const response = await api.get(`/api/users/${userId}/pause`);
      setIsPaused(response.data.isPaused || false);
      setPauseReason(response.data.pauseReason || null);
      setOpenAssignedConversationsCount(
        typeof response.data.openAssignedConversationsCount === 'number'
          ? response.data.openAssignedConversationsCount
          : 0,
      );
    } catch (error) {
      console.error('Erro ao buscar status de pausa:', error);
    } finally {
      setLoadingPause(false);
    }
  };

  const applyPause = async (pause: boolean, reason?: string) => {
    try {
      const currentUserResponse = await api.get('/api/auth/me');
      const userId = currentUserResponse.data.id;

      await api.post(`/api/users/${userId}/pause`, {
        pause,
        reason,
      });

      setIsPaused(pause);
      setPauseReason(reason || null);
      await fetchPauseStatus();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao alterar pausa');
    }
  };

  const handlePauseClick = () => {
    // Se já está em pausa, clicar no botão retoma imediatamente
    if (isPaused) {
      applyPause(false);
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
    // Se está ativo, abrir modal de seleção de motivo
    setShowPauseModal(true);
  };

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  return (
    <div className="flex h-screen bg-background font-body text-on-surface">
      {/* Sidebar */}
      <motion.aside
        className="relative z-10 flex w-64 flex-col bg-surface-container-lowest text-on-surface"
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <motion.div
          className="border-b border-primary/10 px-4 py-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-lg ring-1 ring-white/10">
              <img
                src="/ceape-bot.png"
                alt="Ceape chat"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h2 className="font-headline text-lg font-bold text-primary">Ceape chat</h2>
              <p className="text-[11px] font-medium text-primary/70">Atendimento e performance</p>
            </div>
          </div>
        </motion.div>
        
        {/* Navigation */}
        <nav className="sidebar-scroll relative flex-1 space-y-1 overflow-y-auto overflow-x-visible p-3">
          <div className="mb-4">
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/50">Principal</p>
            <SidebarLink to="/dashboard" icon="📊">Dashboard</SidebarLink>
            <SidebarLink to="/conversations" icon="💬">Conversas</SidebarLink>
          </div>

          <div className="mb-4">
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/50">Gestão</p>
            <SidebarDropdownLink
              icon="👥"
              label="Contatos"
              submenuTitle="CONTATOS E CONTAS"
              items={[
                {
                  to: "/contacts/import",
                  label: "Importar Contatos",
                  icon: "📥"
                },
                {
                  to: "/contacts/auto-created",
                  label: "Contatos",
                  icon: "📋"
                },
                {
                  to: "/contact-lists",
                  label: "Listas",
                  icon: "📋"
                },
              ]}
            />
            <SidebarLink to="/channels" icon="📡">Canais</SidebarLink>
            <SidebarLink to="/journeys" icon="🧩">Jornadas</SidebarLink>
            <SidebarLink to="/templates" icon="🧾">Templates WhatsApp</SidebarLink>
          </div>

          <div className="mb-4">
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/50">Configurações</p>
            <SidebarLink to="/users" icon="👤">Usuários</SidebarLink>
            <SidebarLink to="/sectors" icon="🏢">Setores</SidebarLink>
            <SidebarLink to="/pipelines" icon="📈">Pipelines</SidebarLink>
            <SidebarLink to="/quick-replies" icon="⚡">Respostas Rápidas</SidebarLink>
            <SidebarLink to="/integrations" icon="🔌">Integrações</SidebarLink>
            <SidebarLink to="/bots" icon="🤖">Chatbots</SidebarLink>
          </div>
        </nav>
        
        {/* Footer */}
        <div className="space-y-3 border-t border-primary/10 bg-surface-container-low px-3 py-4">
          {/* User Info */}
          {user && (
            <div className="flex items-center gap-3 rounded-lg bg-surface-container-highest/70 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary-fixed-dim">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-on-surface">{user.name || 'Usuário'}</p>
                <p className="truncate text-xs text-on-surface-variant">{user.email}</p>
              </div>
            </div>
          )}

          {/* Botão de Pausa + Modal de seleção de motivo (estilo cartão) */}
          {!loadingPause && (
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
                        ? `Pausa bloqueada: ${openAssignedConversationsCount} atendimento(s) em aberto (OPEN/WAITING). Transfira ou finalize antes.`
                        : 'Pausar atendimento'
                  }
                >
                  <span className="flex items-center justify-center gap-2">
                    {isPaused ? (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Indisponível
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Ativo
                      </>
                    )}
                  </span>
                </Button>
              </motion.div>

              {/* Modal de pausa estilo cartão flutuante */}
              {showPauseModal && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="fixed bottom-24 left-72 z-50"
                >
                  <div className="w-72 overflow-hidden rounded-xl border border-[rgba(63,73,69,0.2)] bg-surface-container-highest/95 shadow-forest-glow backdrop-blur-xl">
                    {/* Cabeçalho */}
                    <div className="flex items-center justify-between border-b border-primary/10 bg-surface-container px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 text-lg">🖥️</span>
                        <span className="text-sm font-semibold text-on-surface">
                          Indisponível
                        </span>
                      </div>
                      <button
                        onClick={() => setShowPauseModal(false)}
                        className="text-xs text-on-surface-variant hover:text-on-surface"
                        aria-label="Fechar"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Opções de pausa */}
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
                          onClick={() => {
                            applyPause(true, opt.label);
                            setShowPauseModal(false);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-on-surface-variant transition hover:bg-emerald-900/15 hover:text-on-surface"
                        >
                          <span className="text-lg flex-shrink-0">{opt.icon}</span>
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
              transition={{ type: "spring" }}
            >
              {pauseReason}
            </motion.div>
          )}
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
              </span>
            </Button>
          </motion.div>
        </div>
      </motion.aside>
      
      {/* Main Content — min-w-0/min-h-0 evitam que filhos flex estourem a largura/altura do viewport */}
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

      {/* Notificação global de tarefa de pipeline (aparece em qualquer página) */}
      {taskNotification && (
        <div className="fixed bottom-6 right-6 z-[4000] max-w-[320px] rounded-xl border border-primary/20 bg-surface-container-highest/95 p-3.5 shadow-forest-glow backdrop-blur-xl">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-on-surface">
              Tarefa de pipeline
            </span>
            <button
              type="button"
              onClick={() => setTaskNotification(null)}
              className="cursor-pointer border-none bg-transparent text-sm text-on-surface-variant"
              title="Fechar"
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
