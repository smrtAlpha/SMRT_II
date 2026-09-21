// Reads the facts ("claims") stored inside a login token, e.g. whether it belongs to a guest.
// It only reads them, it does not check the signature. Supabase does that on the server.
export function readJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// True if this login token still says "guest". Guest tokens get the lower request limits.
export function tokenSaysGuest(token: string): boolean {
  return readJwtClaims(token)?.is_anonymous === true;
}