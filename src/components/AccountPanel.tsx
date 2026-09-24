import { useEffect, useState } from 'react';
import { Loader2, LogOut, Mail } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { startGoogle, sendEmailCode, verifyEmailCode, checkEmailConfirmed, signOutHere } from '../lib/account';
import type { Mode } from '../lib/account';

type Props = {
  user: User | null;
  // A problem from a Google sign-in that just failed (shown when the pop-up opens)
  startError?: string;
  onClose: () => void;
  // Called after signing out (the app uses it to leave the chat that was open)
  onSignedOut?: () => void;
  // When given, a "Continue as guest" button is shown (used by the pop-up that appears when the app opens)
  onContinueAsGuest?: () => void;
};

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function PrivacyLink() {
  return (
    <a
      href="/privacy.html"
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-slate-400 underline hover:text-slate-600"
    >
      Privacy policy
    </a>
  );
}

const BUTTON =
  'flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const INPUT =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:opacity-50';

export default function AccountPanel({ user, startError = '', onClose, onSignedOut, onContinueAsGuest }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(startError);
  const [info, setInfo] = useState('');

  // While waiting for you to tap the link in the email (creating an account), keep checking whether
  // it has been confirmed, even if you opened the link in another browser.
  useEffect(() => {
    if (step !== 'code' || mode !== 'create') return;
    const timer = setInterval(() => {
      checkEmailConfirmed().then((confirmed) => {
        if (confirmed) clearInterval(timer);
      });
    }, 4000);
    const giveUp = setTimeout(() => clearInterval(timer), 10 * 60 * 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(giveUp);
    };
  }, [step, mode]);

  function switchMode(next: Mode) {
    setMode(next);
    setStep('email');
    setCode('');
    setError('');
    setInfo('');
  }

  async function handleGoogle() {
    setBusy(true);
    setError('');
    const result = await startGoogle(mode, user);
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    // On success the browser is already on its way to Google. If it is still here after a few seconds,
    // let the buttons work again so you can retry.
    setTimeout(() => setBusy(false), 8000);
  }

  async function handleSendEmail() {
    setBusy(true);
    setError('');
    setInfo('');
    const result = await sendEmailCode(mode, email, user);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStep('code');
    setInfo(`We emailed ${email.trim()}.`);
  }

  async function handleVerify() {
    setBusy(true);
    setError('');
    const result = await verifyEmailCode(mode, email, code);
    setBusy(false);
    if (!result.ok) setError(result.message);
    // On success the account state updates by itself and this panel switches to the signed-in view.
  }

  async function handleSignOut() {
    if (!window.confirm('Sign out? Chats saved on this device are hidden until you sign in again.')) return;
    await signOutHere();
    onSignedOut?.();
    onClose();
  }

  // ---------- Signed in ----------
  if (user && user.is_anonymous === false) {
    const providers = (user.identities ?? []).map((i) => i.provider);
    const via = providers.includes('google') ? 'Google' : 'email';
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
            {(user.email ?? '?').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{user.email}</p>
            <p className="text-xs text-slate-500">Signed in with {via}</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Your account and its higher limits work on any device. Your chats and knowledge packs sync automatically
          to any device you sign into with this account.
        </p>
        <button type="button" onClick={handleSignOut} className={BUTTON}>
          <LogOut size={16} />
          Sign out
        </button>
        <p className="mt-4 text-center text-xs text-slate-400">Session ID: {user.id.slice(0, 8)}</p>
        <p className="mt-1 text-center">
          <PrivacyLink />
        </p>
      </div>
    );
  }

  // ---------- Guest ----------
  return (
    <div>
      <div role="tablist" className="mb-4 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        {(['create', 'signin'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            onClick={() => switchMode(tab)}
            className={`rounded-md py-1.5 ${
              mode === tab ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'create' ? 'Create account' : 'Sign in'}
          </button>
        ))}
      </div>

      <h3 className="mb-1 text-base font-semibold text-slate-900">
        {mode === 'create' ? 'Create your account' : 'Welcome back'}
      </h3>
      <p className="mb-4 text-sm text-slate-600">
        {mode === 'create'
          ? "You're using SMRT as a guest. Create an account so you don't lose it if you clear your browser data, and get higher limits. Your chats stay exactly as they are."
          : "Sign in to an account you already have. If this device has chats from using it as a guest, you'll be asked whether to add them to the account or leave them behind."}
      </p>

      <button type="button" onClick={handleGoogle} disabled={busy} className={BUTTON}>
        <GoogleG />
        Continue with Google
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {step === 'email' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendEmail();
          }}
          className="flex flex-col gap-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            aria-label="Email address"
            disabled={busy}
            className={INPUT}
          />
          <button type="submit" disabled={busy || !email.trim()} className={PRIMARY}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            Continue with email
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify();
          }}
          className="flex flex-col gap-2"
        >
          <p className="text-sm text-slate-600">
            {info} Open the email and tap the link, or, if it shows a 6-digit code, type it here:
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="123456"
            aria-label="Code from the email"
            disabled={busy}
            className={INPUT}
          />
          <button type="submit" disabled={busy || code.length < 4} className={PRIMARY}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            Verify code
          </button>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={handleSendEmail} disabled={busy} className="text-blue-600 hover:underline">
              Send again
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
                setInfo('');
              }}
              className="text-slate-500 hover:underline"
            >
              Use a different email
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {onContinueAsGuest && (
        <button
          type="button"
          onClick={onContinueAsGuest}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700 hover:underline"
        >
          Continue as guest
        </button>
      )}
      {user && <p className="mt-3 text-center text-xs text-slate-400">Session ID: {user.id.slice(0, 8)}</p>}
      <p className="mt-1 text-center">
        <PrivacyLink />
      </p>
    </div>
  );
}