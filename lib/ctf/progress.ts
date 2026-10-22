'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Per-lab learning progress, persisted in localStorage so the Solved CTF
 * section remembers how far you got and can show a "completed" indicator on
 * the list. Everything is wrapped in try/catch so private mode / blocked
 * storage never breaks the page — it just falls back to in-memory state.
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

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
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
  const store = readStore();
  const prev = store[slug];
  const mergedStatus = prev && rank(prev.status) > rank(next.status) ? prev.status : next.status;
  const mergedStage = prev ? Math.max(prev.stage, next.stage) : next.stage;
  store[slug] = {
    stage: mergedStage,
    total: next.total,
    status: mergedStatus,
    updatedAt: Date.now(),
  };
  writeStore(store);
  emit();
}

/** Clear one lab's progress (used by each lab's Reset button). */
export function clearProgress(slug: string) {
  const store = readStore();
  if (store[slug]) {
    delete store[slug];
    writeStore(store);
    emit();
  }
}

function getOne(slug: string): LabProgress | null {
  return readStore()[slug] ?? null;
}

/** Subscribe to one lab's progress (list cards, headers). */
export function useLabProgress(slug: string): LabProgress | null {
  const [value, setValue] = useState<LabProgress | null>(null);

  useEffect(() => {
    setValue(getOne(slug));
    const fn = () => setValue(getOne(slug));
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) fn();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener('storage', onStorage);
    };
  }, [slug]);

  return value;
}

/** Subscribe to the whole store (for the "X of N labs done" header). */
export function useAllProgress(): Store {
  const [value, setValue] = useState<Store>({});

  useEffect(() => {
    setValue(readStore());
    const fn = () => setValue(readStore());
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) fn();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return value;
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
