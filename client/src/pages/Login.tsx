import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';

function IconMail({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-[18px] w-[18px] ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m5.5 7.5 6.1 4.4a.8.8 0 0 0 .9 0l6.1-4.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-[18px] w-[18px] ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10V8a4 4 0 1 1 8 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconEye({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-[18px] w-[18px] ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconEyeOff({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-[18px] w-[18px] ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.5 6.4A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 3.7M7.1 7.3A15.3 15.3 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.7-.3 3.9-.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M9.9 10.1a2.5 2.5 0 0 0 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconArrow({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHeadset({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-[18px] w-[18px] ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 13v-1a8 8 0 1 1 16 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="3" y="12" width="4" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="17" y="12" width="4" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 17v2a3 3 0 0 1-3 3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChat({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v7A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9.5" r="0.9" fill="currentColor" />
      <circle cx="12" cy="9.5" r="0.9" fill="currentColor" />
      <circle cx="15" cy="9.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconChart({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 16V10M12 16V7M17 16v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconBot({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="8" width="14" height="11" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="4" r="1" fill="currentColor" />
      <circle cx="9.2" cy="13" r="1.15" fill="currentColor" />
      <circle cx="14.8" cy="13" r="1.15" fill="currentColor" />
    </svg>
  );
}

const FEATURES: { Icon: typeof IconChat; label: string; tone: string }[] = [
  {
    Icon: IconChat,
    label: 'Atendimentos em múltiplos canais',
    tone: 'text-primary',
  },
  {
    Icon: IconChart,
    label: 'Gestão completa e inteligente',
    tone: 'text-secondary',
  },
  {
    Icon: IconBot,
    label: 'Automações nativas e integradas',
    tone: 'text-primary-fixed-dim',
  },
];

const emeraldGradSoft = 'linear-gradient(90deg, #10b981 0%, #34d399 55%, #6ee7b7 100%)';

const WELCOME_SPEECH =
  'Bem-vindo ao L A Crm, sua central de atendimentos.';
const WELCOME_SPEECH_KEY = 'la-crm-login-welcome-spoken';

function speakWelcome(onStarted?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const utter = new SpeechSynthesisUtterance(WELCOME_SPEECH);
  utter.lang = 'pt-BR';
  utter.rate = 0.95;
  utter.pitch = 1.05;
  utter.volume = 1;
  utter.onstart = () => onStarted?.();

  const voices = window.speechSynthesis.getVoices();
  const pt =
    voices.find((v) => /pt-BR/i.test(v.lang) && /maria|francisca|google|microsoft/i.test(v.name)) ||
    voices.find((v) => /pt-BR/i.test(v.lang)) ||
    voices.find((v) => /^pt/i.test(v.lang));
  if (pt) utter.voice = pt;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reloginRequired = searchParams.get('relogin') === '1';

  useEffect(() => {
    const saved = localStorage.getItem('lastLoginEmail');
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (sessionStorage.getItem(WELCOME_SPEECH_KEY) === '1') return;

    let done = false;
    const markDone = () => {
      if (done) return;
      done = true;
      sessionStorage.setItem(WELCOME_SPEECH_KEY, '1');
    };

    const trySpeak = () => {
      if (done) return;
      speakWelcome(markDone);
    };

    const onVoices = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoices);
    window.speechSynthesis.getVoices();

    const timer = window.setTimeout(trySpeak, 800);
    const unlock = () => trySpeak();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/api/auth/login', { email, password });

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
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8 font-body text-on-surface">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(16,185,129,0.12),transparent_48%),radial-gradient(ellipse_at_85%_80%,rgba(52,211,153,0.08),transparent_42%)]" />

      <div className="relative w-full max-w-[1060px] overflow-hidden rounded-[32px] border border-[rgba(63,73,69,0.4)] bg-surface-container shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <div className="grid md:grid-cols-2">
          {/* ===== Lado esquerdo (hero) ===== */}
          <aside className="relative hidden min-h-[680px] flex-col justify-between overflow-hidden bg-gradient-to-b from-surface via-surface-container-low to-primary-container/35 px-10 pb-9 pt-12 md:flex">
            <div
              className="pointer-events-none absolute left-5 top-5 h-16 w-20 opacity-35"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(110,231,183,0.45) 1px, transparent 1.2px)',
                backgroundSize: '10px 10px',
              }}
            />
            <div
              className="pointer-events-none absolute right-6 top-6 h-14 w-16 opacity-30"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(110,231,183,0.4) 1px, transparent 1.2px)',
                backgroundSize: '10px 10px',
              }}
            />
            <div className="pointer-events-none absolute -left-10 bottom-24 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-8 top-28 h-40 w-40 rounded-full bg-secondary/10 blur-3xl" />

            <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
              <div className="relative mb-6 flex items-center justify-center">
                <img
                  src="/ceape-bot.png"
                  alt="Assistente LA Crm"
                  className="relative z-10 h-[340px] w-auto drop-shadow-[0_24px_48px_rgba(16,185,129,0.32)] animate-float-slow"
                />

                <div className="relative z-20 -ml-20 -mt-40 shrink-0">
                  <div
                    className="login-bubble-pop relative h-[110px] w-[200px]"
                    style={{
                      filter:
                        'drop-shadow(0 0 12px rgba(16,185,129,0.45)) drop-shadow(0 8px 18px rgba(0,0,0,0.4))',
                    }}
                  >
                    <svg
                      className="absolute inset-0 h-full w-full"
                      viewBox="0 0 168 92"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <defs>
                        <linearGradient
                          id="bubbleStroke"
                          x1="8"
                          y1="78"
                          x2="160"
                          y2="12"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop offset="0%" stopColor="#059669" />
                          <stop offset="50%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#6ee7b7" />
                        </linearGradient>
                        <linearGradient
                          id="bubbleFill"
                          x1="84"
                          y1="4"
                          x2="84"
                          y2="88"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop offset="0%" stopColor="#1a221c" />
                          <stop offset="55%" stopColor="#0e140f" />
                          <stop offset="100%" stopColor="#0a100b" />
                        </linearGradient>
                        <filter id="bubbleInner" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow
                            dx="0"
                            dy="1"
                            stdDeviation="0.6"
                            floodColor="#ffffff"
                            floodOpacity="0.1"
                          />
                        </filter>
                      </defs>

                      <path
                        d="M28 8
                           H140
                           C154 8 160 14 160 28
                           V52
                           C160 66 154 72 140 72
                           H52
                           L34 86
                           L40 72
                           H28
                           C14 72 8 66 8 52
                           V28
                           C8 14 14 8 28 8
                           Z"
                        fill="url(#bubbleFill)"
                        stroke="url(#bubbleStroke)"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                        filter="url(#bubbleInner)"
                      />
                    </svg>

                    <div className="absolute inset-0 flex items-center px-[26px] pb-3 pt-1">
                      <div className="flex items-end gap-2.5">
                        <span className="font-headline text-[40px] font-extrabold leading-none tracking-tight text-white">
                          LA
                        </span>
                        <div className="mb-1.5 flex flex-col items-center">
                          <span
                            className="bg-clip-text font-headline text-[20px] font-bold leading-none tracking-tight text-transparent"
                            style={{ backgroundImage: emeraldGradSoft }}
                          >
                            Crm
                          </span>
                          <div className="mt-2 flex items-center gap-[5px]">
                            <span className="h-[6px] w-[6px] rounded-full bg-[#059669]" />
                            <span className="h-[6px] w-[6px] rounded-full bg-primary" />
                            <span className="h-[6px] w-[6px] rounded-full bg-secondary" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <h1 className="text-center font-headline text-[2.15rem] font-bold leading-tight tracking-tight text-on-surface xl:text-[2.35rem]">
                Bem-vindo ao{' '}
                <span className="font-extrabold text-white">LA</span>{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: emeraldGradSoft }}
                >
                  Crm
                </span>
              </h1>
              <p className="mt-4 max-w-[380px] text-center text-[15px] leading-relaxed text-on-surface-variant">
                Centralize seus atendimentos, campanhas e jornadas em um só lugar, com a ajuda da
                nossa IA.
              </p>
            </div>

            <ul className="relative z-10 mt-8 grid grid-cols-3 gap-4 border-t border-outline-variant/60 pt-7">
              {FEATURES.map((item) => (
                <li key={item.label} className="flex flex-col items-start gap-3">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-highest/80 ${item.tone}`}
                  >
                    <item.Icon className="h-6 w-6" />
                  </span>
                  <span className="text-[13px] font-medium leading-snug text-on-surface-variant">
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </aside>

          {/* ===== Lado direito (form) ===== */}
          <section className="flex items-center justify-center bg-surface-container-lowest px-7 py-10 sm:px-12">
            <div className="w-full max-w-[340px]">
              <div className="mb-8 flex items-center gap-3 md:hidden">
                <img
                  src="/ceape-bot.png"
                  alt=""
                  className="h-11 w-11 rounded-2xl object-cover ring-1 ring-primary/20"
                />
                <p className="font-headline text-lg font-bold text-on-surface">
                  LA{' '}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: emeraldGradSoft }}
                  >
                    Crm
                  </span>
                </p>
              </div>

              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-primary">
                CRM
              </p>
              <h2 className="font-headline text-[1.7rem] font-bold tracking-tight text-on-surface">
                Acesso ao painel
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-on-surface-variant">
                Entre com suas credenciais para gerenciar canais, contatos e jornadas.
              </p>

              {reloginRequired && (
                <p className="mt-4 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100">
                  Sua sessão expirou após uma atualização do sistema. Faça login novamente para
                  continuar.
                </p>
              )}

              {error && (
                <div className="mt-4 rounded-lg border border-red-500/40 bg-error-container/40 px-3 py-2 text-xs text-on-error-container">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="login-email"
                    className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      <IconMail />
                    </span>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full rounded-lg border border-outline-variant bg-surface-container py-3 pl-11 pr-3 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
                      placeholder="admin@sistema.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="login-password"
                    className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
                  >
                    Senha
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      <IconLock />
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-outline-variant bg-surface-container py-3 pl-11 pr-11 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant transition hover:text-on-surface"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 text-[13px] text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-outline-variant bg-surface-container text-primary focus:ring-primary/40"
                  />
                  <span>Lembrar de mim</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="active-gradient-emerald relative mt-1 flex w-full items-center justify-center rounded-lg px-4 py-3.5 text-sm font-semibold text-on-primary shadow-emerald-send transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{loading ? 'Entrando...' : 'Entrar'}</span>
                  {!loading && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2">
                      <IconArrow />
                    </span>
                  )}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-outline-variant" />
                <span className="text-xs text-on-surface-variant">ou</span>
                <div className="h-px flex-1 bg-outline-variant" />
              </div>

              <button
                type="button"
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[rgba(63,73,69,0.45)] bg-transparent px-4 py-3 text-sm font-medium text-on-surface transition hover:border-primary/30 hover:bg-surface-container-highest"
              >
                <IconHeadset className="shrink-0 text-primary" />
                Fale com o administrador
              </button>

              <p className="mt-7 text-center text-[12px] text-on-surface-variant">
                Novo por aqui?{' '}
                <span className="font-medium text-primary">Fale com o administrador</span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
