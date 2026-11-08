import React, { useEffect, useRef, useState } from 'react';
import { X, LogIn, UserPlus, Loader2, AlertTriangle } from 'lucide-react';
import { safeFetchJson } from '../utils/clientAnalyzer';
import type { AuthUser } from '../types';

interface AuthModalProps {
  initialMode: 'login' | 'register';
  persistentStorage: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: AuthUser) => void;
}

const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-950/80 border border-cyan-500/25 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40';

export const AuthModal: React.FC<AuthModalProps> = ({ initialMode, persistentStorage, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && name.trim().length < 2) { setError('Please enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    const res = await safeFetchJson<{ token: string; user: AuthUser }>(`/api/auth?action=${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'register' ? { name, email, password } : { email, password })
    });
    setBusy(false);
    if (res.ok && res.data?.token) onSuccess(res.data.token, res.data.user);
    else setError(res.error || 'Something went wrong. Please try again.');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="relative w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#0a1024] p-6 shadow-[0_0_40px_rgba(56,189,248,0.2)]">
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
          <X className="w-4 h-4" />
        </button>
        <h2 id="auth-title" className="text-lg font-bold text-white flex items-center gap-2">
          {mode === 'login' ? <LogIn className="w-5 h-5 text-cyan-400" /> : <UserPlus className="w-5 h-5 text-cyan-400" />}
          {mode === 'login' ? 'Sign in' : 'Create your account'}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {mode === 'login' ? 'Sign in to keep your checks in your own account.' : 'An account keeps your past checks private to you. You can still check offers without one.'}
        </p>

        {!persistentStorage && (
          <div className="mt-3 flex gap-2 p-2.5 rounded-lg border border-amber-500/40 bg-amber-950/30 text-[11px] text-amber-200" role="note">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Accounts on this online version are stored temporarily and may reset when the server restarts. For permanent accounts, run the project on your own computer or connect a hosted database.</span>
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-medium text-slate-300 mb-1">Full name</label>
              <input id="auth-name" ref={firstField} className={inputClass} value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={60} />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <input id="auth-email" ref={mode === 'login' ? firstField : undefined} type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300 mb-1">Password {mode === 'register' && <span className="text-slate-500">(at least 8 characters)</span>}</label>
            <input id="auth-password" type="password" className={inputClass} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} maxLength={128} />
          </div>

          {error && <p role="alert" className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400 text-center">
          {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }} className="text-cyan-300 hover:text-cyan-100 underline underline-offset-2">
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};
