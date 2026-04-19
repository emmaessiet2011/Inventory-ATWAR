import React, { useState } from 'react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { verifyUserPassword } from '@/utils/authSecurity';
import { isLiveSyncEnabled } from '@/utils/apiClient';
import { AUTH_REMEMBER_ME_STORAGE_KEY } from '@/utils/hardenedStorage';

interface LoginProps {
  onLogin: () => void;
}

const LOGIN_TIMEOUT_MS = 6000;
const LOGIN_RETRY_TIMEOUT_MS = 12000;
const BACKEND_WARMUP_BUDGET_MS = 18000;
const BACKEND_WARMUP_INTERVAL_MS = 1500;

const resolveApiBase = () =>
  String(import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

const delay = (ms: number): Promise<void> => new Promise(resolve => window.setTimeout(resolve, ms));

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

type LoginAttemptResult = {
  ok: boolean;
  shouldRetry: boolean;
  payload: any;
  token: string;
  user: any;
};

const attemptApiLogin = async (
  apiBase: string,
  identifier: string,
  password: string,
  rememberMe: boolean,
  timeoutMs: number,
): Promise<LoginAttemptResult> => {
  try {
    const response = await fetchWithTimeout(
      `${apiBase}/api/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: identifier, password, rememberMe }),
      },
      timeoutMs,
    );

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
    const user = payload?.user || null;
    const ok = Boolean(response.ok && payload?.ok && token && user);

    return {
      ok,
      shouldRetry: response.status >= 500,
      payload,
      token,
      user,
    };
  } catch {
    return {
      ok: false,
      shouldRetry: true,
      payload: null,
      token: '',
      user: null,
    };
  }
};

const warmUpBackend = async (apiBase: string): Promise<void> => {
  const deadline = Date.now() + BACKEND_WARMUP_BUDGET_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetchWithTimeout(
        `${apiBase}/api/health`,
        { method: 'GET', headers: { Accept: 'application/json' } },
        4000,
      );
      if (response.ok) return;
    } catch {
      // keep trying until deadline
    }
    await delay(BACKEND_WARMUP_INTERVAL_MS);
  }
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const REMEMBER_IDENTIFIER_KEY = 'atwar_login_identifier';
  const { users, setCurrentUser, updateUser, settings } = useGlobalContext();
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_IDENTIFIER_KEY) || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem(AUTH_REMEMBER_ME_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    const identifier = email.trim();
    const liveSyncEnabled = isLiveSyncEnabled();
    const apiBase = resolveApiBase();

    try {
      const persistRememberIdentifier = () => {
        try {
          if (rememberMe) {
            localStorage.setItem(AUTH_REMEMBER_ME_STORAGE_KEY, '1');
            if (identifier) localStorage.setItem(REMEMBER_IDENTIFIER_KEY, identifier);
          } else {
            localStorage.removeItem(AUTH_REMEMBER_ME_STORAGE_KEY);
            localStorage.removeItem(REMEMBER_IDENTIFIER_KEY);
          }
        } catch {
          // ignore browser storage failures
        }
      };

      // --- Production path: API login with warm-up + retry for cold starts ---
      if (liveSyncEnabled) {
        let result = await attemptApiLogin(apiBase, identifier, password, rememberMe, LOGIN_TIMEOUT_MS);
        if (!result.ok && result.shouldRetry) {
          await warmUpBackend(apiBase);
          result = await attemptApiLogin(apiBase, identifier, password, rememberMe, LOGIN_RETRY_TIMEOUT_MS);
        }
        if (result.ok) {
          persistRememberIdentifier();
          localStorage.setItem('atwar_auth_token', result.token);
          updateUser(result.user);
          setCurrentUser(result.user);
          onLogin();
          return;
        }
        setError(
          result.payload?.error
            || (result.shouldRetry
              ? 'Server is waking up. Please wait a few seconds and sign in again.'
              : 'Invalid email or password. Please try again.'),
        );
        return;
      }

      // --- Offline/dev fallback only when live DB sync is disabled ---
      const normalizedIdentifier = identifier.toLowerCase();
      const match = users.find(u => {
        const emailMatch = String(u.email || '').trim().toLowerCase() === normalizedIdentifier;
        const usernameMatch = String(u.username || '').trim().toLowerCase() === normalizedIdentifier;
        return emailMatch || usernameMatch;
      });
      if (!match) {
        setError('Invalid email or password. Please try again.');
        return;
      }
      const normalizedStatus = String(match.status || '').trim().toLowerCase();
      const isActive = normalizedStatus !== 'inactive';
      if (!isActive || match.allowLogin === false) {
        setError('Account is inactive or login is disabled.');
        return;
      }
      const valid = verifyUserPassword(match, password);
      if (!valid) {
        setError('Invalid email or password. Please try again.');
        return;
      }
      persistRememberIdentifier();
      const updated = { ...match, lastLogin: new Date().toISOString() };
      updateUser(updated);
      setCurrentUser(updated);
      onLogin();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Hero Image */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 to-red-900/40 z-10" />
        <img 
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80" 
          alt="Warehouse" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 text-white p-12 max-w-lg">
          <div className="mb-8 select-none">
            <div className="flex items-baseline">
                <span className="text-6xl font-black italic tracking-tighter text-red-600 mr-1">A</span>
                <span className="text-6xl font-black italic tracking-tighter text-white">TWAR</span>
            </div>
            <span className="text-sm font-bold text-slate-300 tracking-[0.3em] uppercase leading-none ml-1">
                AL MUSTAQBAL
            </span>
          </div>
          <p className="text-xl text-slate-300 font-light">
            {settings.businessName} — The next generation of inventory and distribution management.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center lg:text-left">
            <div className="flex flex-col mb-6 lg:items-start items-center select-none">
              <div className="flex items-baseline">
                  <span className="text-4xl font-black italic tracking-tighter text-red-600 mr-[1px]">A</span>
                  <span className="text-4xl font-black italic tracking-tighter text-slate-900">TWAR</span>
              </div>
              <span className="text-[0.65rem] font-bold text-slate-500 tracking-[0.2em] uppercase leading-none ml-0.5">
                  AL MUSTAQBAL
              </span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-2 text-slate-500">Please enter your details to sign in.</p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit} autoComplete="on">
            {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
                    {error}
                </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Email or Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                    placeholder="manager@atwar.com or manager1"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-slate-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-red-600 hover:text-red-500">
                  Forgot password?
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition shadow-lg"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <p className="text-center text-sm text-slate-500">
            Don't have an account? <span className="text-red-600 font-medium cursor-pointer">Contact Admin</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
