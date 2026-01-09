import { useEffect, useState } from 'react';
import axios from 'axios';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    waiting: 0,
    closed: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:3007/api/conversations/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats(response.data);
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginTop: '20px',
        }}
      >
        <StatCard title="Total" value={stats.total} color="#3b82f6" />
        <StatCard title="Abertas" value={stats.open} color="#10b981" />
        <StatCard title="Aguardando" value={stats.waiting} color="#f59e0b" />
        <StatCard title="Fechadas" value={stats.closed} color="#6b7280" />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
      }}
    >
      <h3 style={{ color: '#6b7280', fontSize: '14px', marginBottom: '10px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '32px', fontWeight: 'bold', color }}>
        {value}
      </p>
    </div>
  );
}

