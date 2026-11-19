'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type Theme = 'paper' | 'dusk';

/**
 * Shared reading-theme store. Uses the SAME localStorage key as the home
 * feed ('secdigest_theme') and a module-level subscription so toggling the
 * theme anywhere in the app updates every mounted component at once (home
 * feed, Solved CTF list, write-up pages). Mirrors the body background / meta
 * theme-color behaviour app-wide.
 *
 * Uses useSyncExternalStore with a fixed 'paper' server snapshot and hydrates
 * from localStorage inside an effect so SSR and the initial client hydration
 * render always agree (avoiding React hydration errors #418/#423).
 */

const KEY = 'secdigest_theme';
const SERVER_SNAPSHOT: Theme = 'paper';

let current: Theme = SERVER_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function readInitial(): Theme {
  if (typeof window === 'undefined') return SERVER_SNAPSHOT;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === 'dusk' || saved === 'paper') return saved;
  } catch {
    // ignore storage access errors (private mode, etc.)
  }
  return SERVER_SNAPSHOT;
}

function applyChrome(theme: Theme) {
  if (typeof document === 'undefined') return;
  const isDusk = theme === 'dusk';
  const bg = isDusk ? '#1E1B29' : '#E5DFD3';
  const fg = isDusk ? '#EAE6F2' : '#2A2623';
  document.body.style.backgroundColor = bg;
  document.body.style.color = fg;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bg);
}

function onStorage(e: StorageEvent) {
  if (e.key !== KEY && e.key !== null) return;
  const next: Theme = e.newValue === 'dusk' ? 'dusk' : 'paper';
  hydrated = true;
  if (next !== current) {
    current = next;
    applyChrome(current);
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function getSnapshot(): Theme {
  return current;
}

function getServerSnapshot(): Theme {
  return SERVER_SNAPSHOT;
}

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  const saved = readInitial();
  applyChrome(saved);
  if (saved !== current) {
    current = saved;
    emit();
  }
}

function setTheme(next: Theme) {
  hydrated = true;
  current = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  applyChrome(next);
  emit();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Hydrate from localStorage once after mount so initial client render matches SSR.
  useEffect(() => {
    ensureHydrated();
  }, []);

  const toggle = useCallback(() => {
    setTheme(current === 'paper' ? 'dusk' : 'paper');
  }, []);

  const set = useCallback((t: Theme) => setTheme(t), []);

  return { theme, isDusk: theme === 'dusk', toggle, set };
}
