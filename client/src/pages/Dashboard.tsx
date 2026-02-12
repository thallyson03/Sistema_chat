import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../components/ui/Card';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    waiting: 0,
    closed: 0,
  });
  const [loading, setLoading] = useState(true);

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
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-600">Visão geral do seu sistema de atendimento</p>
      </motion.div>
      
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-20 mb-4"></div>
              <div className="h-10 bg-slate-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <StatCard 
            title="Total de Conversas" 
            value={stats.total} 
            color="blue" 
            icon="📊" 
            delay={0}
            gradient="from-blue-500 to-blue-600"
          />
          <StatCard 
            title="Abertas" 
            value={stats.open} 
            color="green" 
            icon="✅" 
            delay={0.1}
            gradient="from-emerald-500 to-emerald-600"
          />
          <StatCard 
            title="Aguardando" 
            value={stats.waiting} 
            color="amber" 
            icon="⏳" 
            delay={0.2}
            gradient="from-amber-500 to-amber-600"
          />
          <StatCard 
            title="Fechadas" 
            value={stats.closed} 
            color="slate" 
            icon="🔒" 
            delay={0.3}
            gradient="from-slate-500 to-slate-600"
          />
        </motion.div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
  icon,
  delay = 0,
  gradient,
}: {
  title: string;
  value: number;
  color: string;
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
        transition: { duration: 0.2 }
      }}
    >
      <Card className="card-hover border-0 shadow-lg overflow-hidden">
        <CardContent className="p-6">
          {/* Gradient Header */}
          <div className={`h-1 bg-gradient-to-r ${gradient} mb-4 -mx-6 -mt-6`} />
          
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">
                {title}
              </h3>
              <motion.p
                className={`text-4xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: delay + 0.2
                }}
              >
                {value}
              </motion.p>
            </div>
            {icon && (
              <motion.div
                className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-lg`}
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
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className={`h-full bg-gradient-to-r ${gradient} rounded-full`}
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
