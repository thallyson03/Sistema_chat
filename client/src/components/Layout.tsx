import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { SidebarLink } from './ui/SidebarLink';
import { SidebarDropdownLink } from './ui/SidebarDropdownLink';
import { Button } from './ui/Button';

export default function Layout() {
  const navigate = useNavigate();
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [loadingPause, setLoadingPause] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchPauseStatus();
    fetchUser();
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
    } catch (error) {
      console.error('Erro ao buscar status de pausa:', error);
    } finally {
      setLoadingPause(false);
    }
  };

  const handlePause = async () => {
    try {
      const currentUserResponse = await api.get('/api/auth/me');
      const userId = currentUserResponse.data.id;

      const reason = prompt('Motivo da pausa (opcional):') || undefined;

      await api.post(`/api/users/${userId}/pause`, {
        pause: !isPaused,
        reason,
      });

      setIsPaused(!isPaused);
      setPauseReason(reason || null);
      
      if (!isPaused) {
        alert('Pausa ativada. Você não receberá novas conversas.');
      } else {
        alert('Pausa desativada. Você voltou a receber conversas.');
      }

      await fetchPauseStatus();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao alterar pausa');
    }
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
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Sidebar */}
      <motion.aside
        className="w-72 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col shadow-2xl relative z-10 border-r border-slate-700/50"
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <motion.div
          className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-blue-600/20 to-purple-600/20"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/50">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">CRM System</h2>
              <p className="text-xs text-slate-400 font-medium">Atendimento Inteligente</p>
            </div>
          </div>
        </motion.div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-visible relative sidebar-scroll">
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">Principal</p>
            <SidebarLink to="/dashboard" icon="📊">Dashboard</SidebarLink>
            <SidebarLink to="/conversations" icon="💬">Conversas</SidebarLink>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">Gestão</p>
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
                  to: "/contact-lists",
                  label: "Listas",
                  icon: "📋"
                },
              ]}
            />
            <SidebarLink to="/channels" icon="📡">Canais</SidebarLink>
            <SidebarLink to="/campaigns" icon="📢">Campanhas</SidebarLink>
            <SidebarLink to="/journeys" icon="🧩">Jornadas</SidebarLink>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">Configurações</p>
            <SidebarLink to="/users" icon="👤">Usuários</SidebarLink>
            <SidebarLink to="/sectors" icon="🏢">Setores</SidebarLink>
            <SidebarLink to="/pipelines" icon="📈">Pipelines</SidebarLink>
            <SidebarLink to="/quick-replies" icon="⚡">Respostas Rápidas</SidebarLink>
            <SidebarLink to="/integrations" icon="🔌">Integrações</SidebarLink>
            <SidebarLink to="/bots" icon="🤖">Chatbots</SidebarLink>
          </div>
        </nav>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 space-y-3 bg-slate-800/50">
          {/* User Info */}
          {user && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-700/30">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name || 'Usuário'}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          )}

          {/* Botão de Pausa */}
          {!loadingPause && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                variant={isPaused ? "danger" : "primary"}
                onClick={handlePause}
                className="w-full"
                title={isPaused ? 'Retomar atendimento' : 'Pausar atendimento'}
              >
                <span className="flex items-center justify-center gap-2">
                  {isPaused ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Em Pausa
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Ativo
                    </>
                  )}
                </span>
              </Button>
            </motion.div>
          )}
          
          {isPaused && pauseReason && (
            <motion.div
              className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs text-center"
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
              className="w-full text-slate-300 hover:text-white hover:bg-slate-700/50"
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
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="min-h-full">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
