import { Outlet, Link, useNavigate } from 'react-router-dom';

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
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
            to="/bots"
            style={{ color: 'white', textDecoration: 'none', padding: '10px' }}
          >
            Chatbots
          </Link>
        </nav>
        <button
          onClick={handleLogout}
          style={{
            marginTop: 'auto',
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
      </aside>
      <main style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}



