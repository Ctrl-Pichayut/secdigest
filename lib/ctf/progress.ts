'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Per-lab learning progress, persisted in localStorage so the Solved CTF
 * section remembers how far you got and can show a "completed" indicator on
 * the list. Everything is wrapped in try/catch so private mode / blocked
 * storage never breaks the page — it just falls back to in-memory state.
 *
 * Uses useSyncExternalStore with a fixed empty server snapshot and hydrates
 * from localStorage inside an effect so SSR and the initial client hydration
 * render always agree (avoiding React hydration errors #418/#423).
 */

export type LabStatus = 'not-started' | 'in-progress' | 'watched' | 'solved';

export interface LabProgress {
  /** index of the first NOT-yet-done stage (mirrors StageTracker `current`) */
  stage: number;
  /** total stages for this lab, so the list can draw a proportional bar */
  total: number;
  status: LabStatus;
  updatedAt: number;
}

const KEY = 'secdigest_ctf_progress_v1';

type Store = Record<string, LabProgress>;

const EMPTY_STORE: Store = {};

let cache: Store = EMPTY_STORE;
let hydrated = false;

function readStore(): Store {
  if (typeof window === 'undefined') return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === 'object' ? parsed : EMPTY_STORE;
  } catch {
    return EMPTY_STORE;
  }
}

function writeStore(store: Store) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

// Lightweight pub/sub so the list page updates the instant a lab reports
// progress, and multiple hooks on one page stay in sync.
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((fn) => fn());
}

function onStorage(e: StorageEvent) {
  if (e.key !== KEY && e.key !== null) return;
  hydrated = true;
  cache = readStore();
  emit();
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

function getSnapshot(): Store {
  return cache;
}

function getServerSnapshot(): Store {
  return EMPTY_STORE;
}

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  const stored = readStore();
  if (Object.keys(stored).length > 0) {
    cache = stored;
    emit();
  }
}

/** "solved" outranks "watched" outranks "in-progress" — never downgrade. */
function rank(s: LabStatus): number {
  return s === 'solved' ? 3 : s === 'watched' ? 2 : s === 'in-progress' ? 1 : 0;
}

/**
 * Report progress for a lab. Status and stage only ever move forward, so
 * replaying an earlier step (or watching auto-solve after solving) never
 * erases a better result.
 */
export function reportProgress(
  slug: string,
  next: { stage: number; total: number; status: LabStatus }
) {
  if (!hydrated && typeof window !== 'undefined') {
    hydrated = true;
    cache = readStore();
  }
  const prev = cache[slug];
  const mergedStatus = prev && rank(prev.status) > rank(next.status) ? prev.status : next.status;
  const mergedStage = prev ? Math.max(prev.stage, next.stage) : next.stage;
  const nextStore: Store = {
    ...cache,
    [slug]: {
      stage: mergedStage,
      total: next.total,
      status: mergedStatus,
      updatedAt: Date.now(),
    },
  };
  cache = nextStore;
  writeStore(nextStore);
  emit();
}

/** Clear one lab's progress (used by each lab's Reset button). */
export function clearProgress(slug: string) {
  if (!hydrated && typeof window !== 'undefined') {
    hydrated = true;
    cache = readStore();
  }
  if (cache[slug]) {
    const nextStore: Store = { ...cache };
    delete nextStore[slug];
    cache = nextStore;
    writeStore(nextStore);
    emit();
  }
}

/** Subscribe to the whole store (for the "X of N labs done" header). */
export function useAllProgress(): Store {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    ensureHydrated();
  }, []);

  return store;
}

/** Subscribe to one lab's progress (list cards, headers). */
export function useLabProgress(slug: string): LabProgress | null {
  const store = useAllProgress();
  return store[slug] ?? null;
}

/** A lab counts as "done" for the header tally once watched or solved. */
export function isDone(p: LabProgress | null | undefined): boolean {
  return !!p && (p.status === 'solved' || p.status === 'watched');
}

/**
 * Convenience hook for a lab component: gives a `report` callback bound to the
 * slug plus a `clear`. Labs call `report(stage, total, status)` as the learner
 * advances; the stage/status merge rules live in reportProgress.
 */
export function useProgressReporter(slug: string) {
  const report = useCallback(
    (stage: number, total: number, status: LabStatus) => {
      reportProgress(slug, { stage, total, status });
    },
    [slug]
  );
  const clear = useCallback(() => clearProgress(slug), [slug]);
  return { report, clear };
}
