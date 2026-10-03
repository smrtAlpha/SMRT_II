import { useSyncExternalStore } from 'react';

// "system" is the default: follow the device's light/dark setting, and keep following it if it
// changes while the app is open (e.g. automatic dark mode at sunset). "light"/"dark" are explicit
// overrides that stay put regardless of the device.
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'smrt-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
// Browser chrome color (Android address bar, installed-app title bar) for each theme.
const CHROME_COLOR: Record<ResolvedTheme, string> = { light: '#f5f8ff', dark: '#0b1220' };

const listeners = new Set<() => void>();
let preference: ThemePreference = readStoredPreference();
let started = false;

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // storage unavailable: fall through to the default
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(DARK_QUERY).matches;
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Writes the current theme onto <html>. `animate` adds a short cross-fade (skipped for the very
// first paint, and for people who prefer reduced motion).
function apply(animate: boolean) {
  const root = document.documentElement;
  const resolved = resolve(preference);

  if (animate && !prefersReducedMotion()) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 400);
  }

  root.classList.toggle('dark', resolved === 'dark');

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = CHROME_COLOR[resolved];
}

function notify() {
  listeners.forEach((listener) => listener());
}

// Call once, before React renders, so the right theme is on the page from the first paint.
export function initTheme() {
  if (started || typeof window === 'undefined') return;
  started = true;
  apply(false);

  // System mode: follow the device live.
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', () => {
    if (preference !== 'system') return;
    apply(true);
    notify();
  });

  // Another tab changed the setting: follow it.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    preference = readStoredPreference();
    apply(true);
    notify();
  });
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage unavailable: the choice still applies until the page closes
  }
  apply(true);
  notify();
}

// The snapshot is a plain string so React can compare it cheaply; it changes when either the
// preference or (in System mode) what it resolves to changes.
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): string {
  return `${preference}:${resolve(preference)}`;
}

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => 'system:light');
  const [pref, resolved] = snapshot.split(':') as [ThemePreference, ResolvedTheme];

  return {
    preference: pref,
    resolved,
    isDark: resolved === 'dark',
    setPreference: setThemePreference,
    // Quick flip between the two looks. It sets an explicit choice; "System" is picked in Settings.
    toggle: () => setThemePreference(resolved === 'dark' ? 'light' : 'dark'),
  };
}

// hey