import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

// "create": turn the current guest into a real account (keeps the same ID, so nothing is lost).
// "signin": sign in to an account you already have.
export type Mode = 'create' | 'signin';
export type Result = { ok: true } | { ok: false; message: string };

// ---- Remembering the guest ID while signing in to an existing account ----
// Signing in to an existing account swaps your guest ID for the account's ID. This note lets the
// app check afterwards whether there were guest chats on this device, so it can ask whether to
// add them to the account (or burn them if you say no).
const MIGRATE_KEY = 'smrt-migrate-from';

export function rememberGuestForMigration(userId: string) {
  try {
    localStorage.setItem(MIGRATE_KEY, userId);
  } catch {
    // storage unavailable: skip
  }
}
export function readMigrationMarker(): string | null {
  try {
    return localStorage.getItem(MIGRATE_KEY);
  } catch {
    return null;
  }
}
export function clearMigrationMarker() {
  try {
    localStorage.removeItem(MIGRATE_KEY);
  } catch {
    // storage unavailable: skip
  }
}

// ---- Plain-language error messages ----
export function friendlyAuthError(error: { code?: string; message?: string }): string {
  const code = error.code ?? '';
  const text = (error.message ?? '').toLowerCase();

  if (code === 'identity_already_exists' || text.includes('already linked')) {
    return 'That Google account already has a SMRT account. Choose "Already have an account? Sign in" instead.';
  }
  if (code === 'email_exists' || code === 'user_already_exists' || text.includes('already been registered')) {
    return 'That email already has an account. Choose "Already have an account? Sign in" instead.';
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || text.includes('rate limit')) {
    return 'Too many emails have been requested. Wait a few minutes and try again.';
  }
  if (code === 'otp_expired' || text.includes('expired') || text.includes('token has expired or is invalid')) {
    return 'That code is wrong or has expired. Check it, or ask for a new one.';
  }
  if (code === 'validation_failed' || text.includes('invalid format') || text.includes('valid email')) {
    return "That doesn't look like a valid email address.";
  }
  if (code === 'provider_disabled' || text.includes('provider is not enabled') || text.includes('unsupported provider')) {
    return "Google sign-in isn't set up yet.";
  }
  if (code === 'manual_linking_disabled' || text.includes('manual linking')) {
    return "Creating accounts isn't switched on yet (manual linking is off in Supabase).";
  }
  if (code === 'signup_disabled' || code === 'otp_disabled' || text.includes('signups not allowed')) {
    return 'No account uses that email. Choose "Create account" instead.';
  }
  return error.message || 'Something went wrong. Please try again.';
}

const returnAddress = () => window.location.origin;

// ---- Google ----
// Leaves SMRT for Google's page and comes back signed in. Nothing more happens here after redirecting.
export async function startGoogle(mode: Mode, user: User | null): Promise<Result> {
  if (mode === 'signin' && user?.is_anonymous) rememberGuestForMigration(user.id);

  const options = { redirectTo: returnAddress() };
  const { data, error } =
    mode === 'create'
      ? await supabase.auth.linkIdentity({ provider: 'google', options })
      : await supabase.auth.signInWithOAuth({ provider: 'google', options });

  if (error) return { ok: false, message: friendlyAuthError(error) };
  if (data?.url) window.location.assign(data.url);
  return { ok: true };
}

// ---- Email ----
// Sends an email with a link (and, if the email template has one, a 6-digit code).
export async function sendEmailCode(mode: Mode, email: string, user: User | null): Promise<Result> {
  const clean = email.trim();
  if (!clean.includes('@')) return { ok: false, message: "That doesn't look like a valid email address." };

  if (mode === 'create') {
    const { error } = await supabase.auth.updateUser({ email: clean }, { emailRedirectTo: returnAddress() });
    if (error) return { ok: false, message: friendlyAuthError(error) };
    return { ok: true };
  }

  if (user?.is_anonymous) rememberGuestForMigration(user.id);
  const { error } = await supabase.auth.signInWithOtp({
    email: clean,
    options: { shouldCreateUser: false, emailRedirectTo: returnAddress() },
  });
  if (error) return { ok: false, message: friendlyAuthError(error) };
  return { ok: true };
}

// Checks the 6-digit code from the email.
export async function verifyEmailCode(mode: Mode, email: string, code: string): Promise<Result> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: mode === 'create' ? 'email_change' : 'email',
  });
  if (error) return { ok: false, message: friendlyAuthError(error) };
  // A fresh login token, so the "registered" limits apply right away.
  await supabase.auth.refreshSession();
  return { ok: true };
}

// While waiting for you to tap the link in the email: has the account been confirmed yet?
export async function checkEmailConfirmed(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  if (data.user.is_anonymous === false) {
    await supabase.auth.refreshSession();
    return true;
  }
  return false;
}

// Signs out on this device only (other devices stay signed in).
export async function signOutHere() {
  await supabase.auth.signOut({ scope: 'local' });
}