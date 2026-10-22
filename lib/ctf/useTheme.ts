'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'paper' | 'dusk';

/**
 * Shared reading-theme store. Uses the SAME localStorage key as the home
 * feed ('secdigest_theme') and a module-level subscription so toggling the
 * theme anywhere in the app updates every mounted component at once (home
 * feed, Solved CTF list, write-up pages). Mirrors the body background / meta
 * theme-color behaviour app-wide.
 */

const KEY = 'secdigest_theme';

let current: Theme = 'paper';
let hydrated = false;
const listeners = new Set<() => void>();

function readInitial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dusk' || saved === 'paper') return saved;
  } catch {
    // ignore storage access errors (private mode, etc.)
  }
  return 'paper';
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

function setTheme(next: Theme) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  applyChrome(next);
  listeners.forEach((fn) => fn());
}

export function useTheme() {
  const [, force] = useState(0);

  // Hydrate from storage once, app-wide, then keep chrome in sync.
  useEffect(() => {
    if (!hydrated) {
      hydrated = true;
      current = readInitial();
      applyChrome(current);
      listeners.forEach((fn) => fn());
    }
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === 'dusk' || e.newValue === 'paper')) {
        current = e.newValue;
        applyChrome(current);
        fn();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggle = useCallback(() => {
    setTheme(current === 'paper' ? 'dusk' : 'paper');
  }, []);

  const set = useCallback((t: Theme) => setTheme(t), []);

  return { theme: current, isDusk: current === 'dusk', toggle, set };
}
