import { friendlyAuthError } from './account';

// When a Google sign-in fails, Supabase sends you back to SMRT with the reason in the address bar.
// It is read as soon as this file loads, before anything else can change the address.
function readAndClean(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const code = hash.get('error_code') ?? query.get('error_code');
  const description = hash.get('error_description') ?? query.get('error_description');
  if (!code && !description) return null;

  window.history.replaceState(null, '', window.location.pathname);
  return friendlyAuthError({ code: code ?? undefined, message: description ?? undefined });
}

let pending: string | null = readAndClean();

// Returns the message once (or null if the last sign-in didn't fail).
export function takeAuthRedirectError(): string | null {
  const message = pending;
  pending = null;
  return message;
}