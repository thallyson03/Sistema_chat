import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/auth/login', {
        email,
        password,
      });

      localStorage.setItem('token', response.data.token);

      if (rememberMe) {
        localStorage.setItem('lastLoginEmail', email);
      } else {
        localStorage.removeItem('lastLoginEmail');
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-800 px-4">
      <div className="relative max-w-5xl w-full rounded-[32px] bg-white/5 border border-white/10 shadow-[0_40px_120px_rgba(15,23,42,0.6)] overflow-hidden backdrop-blur-2xl">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />

        <div className="relative grid md:grid-cols-2 gap-0">
          {/* Lado esquerdo: mascote CEAPE */}
          <div className="hidden md:flex flex-col items-center justify-center py-12 pl-10 pr-4">
            <img
              src="/ceape-bot.png"
              alt="Assistente virtual CEAPE"
              className="max-h-80 w-auto drop-shadow-[0_30px_80px_rgba(15,23,42,0.7)] animate-float-slow"
            />
            <div className="mt-8 text-center text-slate-100">
              <h1 className="text-2xl font-bold tracking-tight">
                Bem-vindo ao assistente CEAPE
              </h1>
              <p className="mt-2 text-sm text-slate-300 max-w-sm">
                Centralize seus atendimentos, campanhas e jornadas em um só lugar,
                com a ajuda do nosso robô.
              </p>
            </div>
          </div>

          {/* Lado direito: formulário */}
          <div className="flex items-center justify-center py-10 px-6 md:px-10 bg-gradient-to-br from-slate-950/70 via-slate-900/70 to-emerald-950/60">
            <div className="w-full max-w-sm">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg">
                    <span className="text-xl">💬</span>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-emerald-300 font-semibold">
                      CRM CHAT
                    </p>
                    <h2 className="text-xl font-bold text-white leading-tight">
                      Acesso ao painel
                    </h2>
                  </div>
                </div>
                <p className="text-xs text-slate-300">
                  Entre com suas credenciais para gerenciar canais, contatos e jornadas.
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-emerald-500/30 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40 transition"
                    placeholder="voce@empresa.com"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                      Senha
                    </label>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-emerald-300 hover:text-emerald-200"
                      onClick={() => alert('Recuperação de senha em desenvolvimento.')}
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-emerald-500/30 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40 transition"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-900 text-emerald-500 focus:ring-emerald-500/60"
                    />
                    <span>Lembrar de mim</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_30px_rgba(16,185,129,0.55)] transition hover:brightness-105 hover:shadow-[0_16px_40px_rgba(16,185,129,0.7)] disabled:from-emerald-700 disabled:to-teal-700 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>

              <div className="mt-6 text-center text-[11px] text-slate-400">
                <p>
                  Novo por aqui?{' '}
                  <span className="font-semibold text-emerald-300 hover:text-emerald-200 cursor-not-allowed">
                    Fale com o administrador
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


