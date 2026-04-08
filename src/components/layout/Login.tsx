import React, { useState } from 'react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { verifyUserPassword } from '@/utils/authSecurity';
import { isLiveSyncEnabled } from '@/utils/apiClient';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { users, setCurrentUser, updateUser, settings } = useGlobalContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // --- Try the backend API first (production path) ---
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}/api/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      const payload = await response.json();
      const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
      if (!response.ok || !payload.ok || !token || !payload?.user) {
        setError(payload.error || 'Invalid email or password. Please try again.');
        return;
      }

      localStorage.setItem('atwar_auth_token', token);
      updateUser(payload.user);
      setCurrentUser(payload.user);
      onLogin();
      return;
    } catch {
      // In production DB-sync mode, do not silently fall back to local auth.
      // A successful local fallback without token causes protected API 401s.
      if (isLiveSyncEnabled()) {
        setError('Unable to reach the server. Please check connection/backend and try again.');
        return;
      }
      // Offline/dev fallback only when live DB sync is disabled.
    }

    // --- Offline fallback: verify against localStorage users ---
    const normalizedIdentifier = email.trim().toLowerCase();
    const match = users.find(u => {
      const emailMatch = String(u.email || '').trim().toLowerCase() === normalizedIdentifier;
      const usernameMatch = String(u.username || '').trim().toLowerCase() === normalizedIdentifier;
      return emailMatch || usernameMatch;
    });
    if (!match) {
      setError('Invalid email or password. Please try again.');
      return;
    }
    const valid = verifyUserPassword(match, password);
    if (!valid) {
      setError('Invalid email or password. Please try again.');
      return;
    }
    const updated = { ...match, lastLogin: new Date().toISOString() };
    updateUser(updated);
    setCurrentUser(updated);
    onLogin();
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

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition shadow-lg"
            >
              Sign In
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
