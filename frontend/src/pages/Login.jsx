import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiError } from '../api/client.js';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Already signed in → redirect declaratively (don't navigate during render).
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  }

  function fill(role) {
    setEmail(role === 'manager' ? 'manager@rksuites.com' : 'frontdesk@rksuites.com');
    setPassword(role === 'manager' ? 'Manager@123' : 'Frontdesk@123');
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-12 text-paper-100 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-lg font-semibold text-white">
            RK
          </div>
          <div className="text-lg font-semibold text-white">SuitesOps</div>
        </div>

        <div className="relative max-w-md">
          <div className="eyebrow text-amber-500">RK Suites · Hyderabad</div>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.1] text-white">
            The front desk, finally off paper.
          </h1>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-brand-100/80">
            Check-ins, dues, inventory and daily occupancy — one clean console for the
            whole property. Built for the people behind the desk.
          </p>
        </div>

        <div className="relative flex gap-8 text-brand-100/70">
          <Stat n="11" l="Rooms managed" />
          <Stat n="< 3s" l="Dashboard load" />
          <Stat n="100%" l="Audited actions" />
        </div>
      </div>

      {/* Form */}
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-lg font-semibold text-white">
                RK
              </div>
              <div className="text-lg font-semibold">SuitesOps</div>
            </div>
          </div>

          <div className="eyebrow">Welcome back</div>
          <h2 className="mt-1.5 text-2xl font-semibold">Sign in to continue</h2>
          <p className="mt-1 text-sm text-ink-faint">Use your staff credentials.</p>

          {err && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              <span className="mt-0.5">⚠</span>
              <span>{err}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@rksuites.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-faint transition hover:bg-paper-100 hover:text-ink-soft"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8">
            <div className="flex items-center gap-3 text-[0.7rem] uppercase tracking-wider text-ink-faint">
              <span className="h-px flex-1 bg-paper-200" />
              Demo access
              <span className="h-px flex-1 bg-paper-200" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => fill('manager')} className="btn-secondary btn-sm">
                Manager
              </button>
              <button onClick={() => fill('frontdesk')} className="btn-secondary btn-sm">
                Front Desk
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, l }) {
  return (
    <div>
      <div className="text-2xl font-semibold text-white">{n}</div>
      <div className="text-[0.72rem] tracking-wide">{l}</div>
    </div>
  );
}

function eyeBase(props) {
  return {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    viewBox: '0 0 24 24',
    className: 'h-5 w-5',
    ...props,
  };
}
function EyeIcon(p) {
  return (
    <svg {...eyeBase(p)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon(p) {
  return (
    <svg {...eyeBase(p)}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3 3.9M6.1 6.1A17.6 17.6 0 0 0 2 11s3.5 7 10 7a10.9 10.9 0 0 0 4.1-.8" />
    </svg>
  );
}
