import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../utils/api';

export default function Layout() {
  const navigate = useNavigate();
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [loadingPause, setLoadingPause] = useState(true);

  useEffect(() => {
    fetchPauseStatus();
  }, []);

  const fetchPauseStatus = async () => {
    try {
      // Buscar usuário atual
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
      // Buscar usuário atual
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

      // Recarregar status
      await fetchPauseStatus();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao alterar pausa');
    }
  };

  const handleLogout = async () => {
    try {
      // Chamar endpoint de logout para marcar como offline
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
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside
        style={{
          width: '250px',
          backgroundColor: '#1f2937',
          color: 'white',
          padding: '20px',
        }}
      >
        <h2 style={{ marginBottom: '30px' }}>Atendimento</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link
            to="/dashboard"
            style={{ color: 'white', textDecoration: 'none', padding: '10px' }}
          >
            Dashboard
          </Link>
          <Link
            to="/conversations"
            style={{ color: 'white', textDecoration: 'none', padding: '10px' }}
          >
            Conversas
          </Link>
          <Link
            to="/channels"
            style={{ color: 'white', textDecoration: 'none', padding: '10px' }}
          >
            Canais
          </Link>
          <Link
            to="/integrations"
            style={{ color: 'white', textDecoration: 'none', padding: '10px' }}
          >
            Integrações
          </Link>
          <Link
            to="/quick-replies"
            style={{ color: 'white', textDecoration: 'none', padding: '10px' }}
          >
            Respostas Rápidas
          </Link>
          <Link
            to="/sectors"
            style={{ color: 'white', textDecoration: 'none', padding: '10px' }}
          >
            Setores
          </Link>
          <Link
            to="/users"
            style={{ color: 'white', textDecoration: 'none', padding: '10px' }}
          >
            Usuários
          </Link>
          <Link
            to="/bots"
            style={{ color: 'white', textDecoration: 'none', padding: '10px' }}
          >
            Chatbots
          </Link>
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Botão de Pausa */}
          {!loadingPause && (
            <button
              onClick={handlePause}
              style={{
                padding: '10px',
                backgroundColor: isPaused ? '#f59e0b' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              title={isPaused ? 'Retomar atendimento' : 'Pausar atendimento'}
            >
              {isPaused ? '⏸️ Em Pausa' : '▶️ Ativo'}
            </button>
          )}
          {isPaused && pauseReason && (
            <div
              style={{
                padding: '8px',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                borderRadius: '5px',
                fontSize: '12px',
                textAlign: 'center',
              }}
            >
              {pauseReason}
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: '10px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}



