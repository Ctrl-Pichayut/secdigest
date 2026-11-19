'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type Theme = 'paper' | 'dusk';

/**
 * Shared reading-theme store. Uses the SAME localStorage key as the home
 * feed ('secdigest_theme') and a module-level subscription so toggling the
 * theme anywhere in the app updates every mounted component at once (home
 * feed, Solved CTF list, write-up pages). Mirrors the body background,
 * html[data-theme] attribute, and meta theme-color behaviour app-wide.
 *
 * Uses useSyncExternalStore with a fixed 'paper' server snapshot and a client
 * snapshot backed by html[data-theme] (set before first paint by the inline
 * script in app/layout.tsx) so SSR and hydration always agree (avoiding React
 * hydration errors #418/#423) while dusk pages update before reveal.
 */

const KEY = 'secdigest_theme';
const SERVER_SNAPSHOT: Theme = 'paper';

let current: Theme = SERVER_SNAPSHOT;
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function readThemeFromDom(): Theme | null {
  if (typeof document === 'undefined') return null;
  const attr = document.documentElement.dataset.theme;
  if (attr === 'dusk' || attr === 'paper') return attr;
  return null;
}

function readInitial(): Theme {
  const fromDom = readThemeFromDom();
  if (fromDom) return fromDom;
  if (typeof window === 'undefined') return SERVER_SNAPSHOT;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === 'dusk' || saved === 'paper') return saved;
  } catch {
    // ignore storage access errors (private mode, etc.)
  }
  return SERVER_SNAPSHOT;
}

function markThemeReady() {
  if (typeof document === 'undefined') return;
  if (document.documentElement.dataset.themeReady !== '1') {
    document.documentElement.dataset.themeReady = '1';
  }
}

function applyChrome(theme: Theme) {
  if (typeof document === 'undefined') return;
  const isDusk = theme === 'dusk';
  const bg = isDusk ? '#1E1B29' : '#E5DFD3';
  const fg = isDusk ? '#EAE6F2' : '#2A2623';
  if (document.documentElement.dataset.theme !== theme) {
    document.documentElement.dataset.theme = theme;
  }
  document.body.style.backgroundColor = bg;
  document.body.style.color = fg;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bg);
}

function onStorage(e: StorageEvent) {
  if (e.key !== KEY && e.key !== null) return;
  const next: Theme = e.newValue === 'dusk' ? 'dusk' : 'paper';
  initialized = true;
  if (next !== current || readThemeFromDom() !== next) {
    current = next;
    applyChrome(current);
    markThemeReady();
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
  if (typeof document === 'undefined') return SERVER_SNAPSHOT;
  const fromDom = readThemeFromDom();
  if (fromDom) {
    current = fromDom;
    initialized = true;
    return fromDom;
  }
  if (!initialized) {
    current = readInitial();
    initialized = true;
  }
  return current;
}

function getServerSnapshot(): Theme {
  return SERVER_SNAPSHOT;
}

function setTheme(next: Theme) {
  initialized = true;
  current = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  applyChrome(next);
  markThemeReady();
  emit();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Sync document chrome and reveal #__app once the rendered theme matches the
  // client snapshot (after React finishes the post-hydration dusk sync).
  useEffect(() => {
    const expected = getSnapshot();
    applyChrome(expected);
    if (theme === expected) {
      markThemeReady();
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(getSnapshot() === 'paper' ? 'dusk' : 'paper');
  }, []);

  const set = useCallback((t: Theme) => setTheme(t), []);

  return { theme, isDusk: theme === 'dusk', toggle, set };
}
