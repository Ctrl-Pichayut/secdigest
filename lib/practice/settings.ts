'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LangWeights } from './scheduler';
import { ACTIVE_LANGS, LANGS } from './types';

/**
 * Practice preferences. These are per-device conveniences, so they live in
 * localStorage; review history (the data worth keeping) syncs via store.ts.
 */

export interface PracticeSettings {
  weights: LangWeights;
  /** Sessions per week that count as "on track". */
  weeklyGoal: number;
  /** Max new cards introduced per session, so reviews never pile up. */
  newPerSession: number;
}

export const WEIGHT_PRESETS: { id: string; label: string; weights: LangWeights }[] = [
  { id: 'python-focus', label: 'Python focus', weights: { python: 60, c: 20, js: 12, java: 8 } },
  { id: 'python-only', label: 'Python only', weights: { python: 100, c: 0, js: 0, java: 0 } },
  { id: 'python-c', label: 'Python + C', weights: { python: 65, c: 35, js: 0, java: 0 } },
  { id: 'balanced', label: 'Balanced', weights: { python: 25, c: 25, js: 25, java: 25 } },
];

function defaultWeights(): LangWeights {
  if (ACTIVE_LANGS.length === 1) {
    return Object.fromEntries(LANGS.map((l) => [l, l === ACTIVE_LANGS[0] ? 100 : 0])) as LangWeights;
  }
  return WEIGHT_PRESETS[0].weights;
}

export const DEFAULT_SETTINGS: PracticeSettings = {
  weights: defaultWeights(),
  weeklyGoal: 4,
  newPerSession: 5,
};

const KEY = 'secdigest_practice_settings';

function read(): PracticeSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PracticeSettings>;
    return {
      // With a single active language, ignore any saved multi-language weights.
      weights: ACTIVE_LANGS.length === 1 ? DEFAULT_SETTINGS.weights : { ...DEFAULT_SETTINGS.weights, ...(parsed.weights ?? {}) },
      weeklyGoal: Math.min(7, Math.max(1, parsed.weeklyGoal ?? DEFAULT_SETTINGS.weeklyGoal)),
      newPerSession: Math.min(10, Math.max(0, parsed.newPerSession ?? DEFAULT_SETTINGS.newPerSession)),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function usePracticeSettings() {
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(read());
  }, []);

  const update = useCallback((patch: Partial<PracticeSettings>) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        ...patch,
        ...(ACTIVE_LANGS.length === 1 ? { weights: DEFAULT_SETTINGS.weights } : {}),
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return { settings, update };
}

export function presetIdFor(weights: LangWeights): string | null {
  const match = WEIGHT_PRESETS.find((p) => (Object.keys(p.weights) as (keyof LangWeights)[]).every((k) => p.weights[k] === weights[k]));
  return match ? match.id : null;
}
