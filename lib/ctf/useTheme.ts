'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'paper' | 'dusk';

/**
 * Shared reading-theme hook. Uses the SAME localStorage key as the
 * home feed ('secdigest_theme'), so toggling the theme anywhere in the
 * app stays in sync. Mirrors the body background / meta theme-color
 * behaviour from app/page.tsx.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('paper');

  // Load persisted theme once on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('secdigest_theme');
      if (saved === 'dusk' || saved === 'paper') {
        setTheme(saved);
      }
    } catch {
      // ignore storage access errors (private mode, etc.)
    }
  }, []);

  // Keep the page chrome in sync with the active theme.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isDusk = theme === 'dusk';
    const bg = isDusk ? '#1E1B29' : '#E5DFD3';
    const fg = isDusk ? '#EAE6F2' : '#2A2623';
    document.body.style.backgroundColor = bg;
    document.body.style.color = fg;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', bg);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'paper' ? 'dusk' : 'paper';
      try {
        localStorage.setItem('secdigest_theme', next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { theme, isDusk: theme === 'dusk', toggle };
}
