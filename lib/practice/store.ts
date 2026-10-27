'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ReviewRow, SessionRow } from './types';

/**
 * Practice progress store: local-first with Supabase sync.
 *
 * - Every write lands in localStorage immediately, so practice works offline
 *   (train tunnels) and before the Phase 9 SQL migration has been run.
 * - Writes are queued and pushed to Supabase; failed pushes retry on the next
 *   sync (page load or coming back online).
 * - Pulls merge by `updated_at`, so the newest answer for a card wins.
 */

const KEY = 'secdigest_practice_v1';
/** Keep this many days of sessions locally (weekly goal + pace only need recent ones). */
const SESSION_HISTORY_DAYS = 120;

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'local-only';

interface Cache {
  reviews: Record<string, ReviewRow>;
  sessions: SessionRow[];
  pendingReviews: string[];
  pendingSessions: string[];
}

const EMPTY: Cache = { reviews: {}, sessions: [], pendingReviews: [], pendingSessions: [] };

let cache: Cache | null = null;
let status: SyncStatus = 'idle';
let syncPromise: Promise<void> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function getCache(): Cache {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Cache>) } : { ...EMPTY };
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}

function persist() {
  const c = getCache();
  const cutoff = Date.now() - SESSION_HISTORY_DAYS * 86_400_000;
  c.sessions = c.sessions.filter((s) => new Date(s.finished_at).getTime() >= cutoff);
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // ignore storage errors (quota, private mode)
  }
}

function setStatus(next: SyncStatus) {
  if (status !== next) {
    status = next;
    emit();
  }
}

/** Missing table (migration not run) vs. network trouble. */
function classify(error: { code?: string; message?: string } | null): SyncStatus {
  if (!error) return 'synced';
  if (error.code === 'PGRST205' || error.code === '42P01') return 'local-only';
  return 'offline';
}

async function push(): Promise<SyncStatus> {
  const c = getCache();
  if (c.pendingReviews.length > 0) {
    const ids = [...c.pendingReviews];
    const rows = ids.map((id) => c.reviews[id]).filter(Boolean);
    const { error } = await supabase.from('practice_reviews').upsert(rows, { onConflict: 'card_id' });
    if (error) return classify(error);
    c.pendingReviews = c.pendingReviews.filter((id) => !ids.includes(id));
  }
  if (c.pendingSessions.length > 0) {
    const ids = [...c.pendingSessions];
    const rows = c.sessions.filter((s) => ids.includes(s.id));
    const { error } = await supabase.from('practice_sessions').upsert(rows, { onConflict: 'id' });
    if (error) return classify(error);
    c.pendingSessions = c.pendingSessions.filter((id) => !ids.includes(id));
  }
  persist();
  return 'synced';
}

async function pull(): Promise<SyncStatus> {
  const c = getCache();
  const since = new Date(Date.now() - SESSION_HISTORY_DAYS * 86_400_000).toISOString();
  const [reviewsRes, sessionsRes] = await Promise.all([
    supabase.from('practice_reviews').select('*'),
    supabase.from('practice_sessions').select('*').gte('finished_at', since),
  ]);
  if (reviewsRes.error) return classify(reviewsRes.error);
  if (sessionsRes.error) return classify(sessionsRes.error);

  const pending = new Set(c.pendingReviews);
  for (const row of (reviewsRes.data ?? []) as ReviewRow[]) {
    const local = c.reviews[row.card_id];
    if (pending.has(row.card_id)) continue; // our unsent answer is newer
    if (!local || new Date(row.updated_at) > new Date(local.updated_at)) {
      c.reviews[row.card_id] = row;
    }
  }
  const known = new Set(c.sessions.map((s) => s.id));
  for (const row of (sessionsRes.data ?? []) as SessionRow[]) {
    if (!known.has(row.id)) c.sessions.push(row);
  }
  persist();
  return 'synced';
}

/** Push queued writes, then pull the server copy. Concurrent calls share one run. */
export function syncNow(): Promise<void> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    setStatus('syncing');
    try {
      let result = await push();
      if (result === 'synced') result = await pull();
      setStatus(result);
    } catch {
      setStatus('offline');
    } finally {
      syncPromise = null;
      emit();
    }
  })();
  return syncPromise;
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void syncNow();
  }, 1500);
}

export function recordReview(row: ReviewRow) {
  const c = getCache();
  c.reviews[row.card_id] = row;
  if (!c.pendingReviews.includes(row.card_id)) c.pendingReviews.push(row.card_id);
  persist();
  emit();
  schedulePush();
}

export function recordSession(row: SessionRow) {
  const c = getCache();
  c.sessions = [...c.sessions.filter((s) => s.id !== row.id), row];
  if (!c.pendingSessions.includes(row.id)) c.pendingSessions.push(row.id);
  persist();
  emit();
  schedulePush();
}

export function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // RFC 4122 v4 fallback for older browsers / insecure contexts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

let syncedThisLoad = false;

/**
 * Subscribe to practice progress. Returns empty data during SSR / first render
 * (so markup matches), then the local cache, then the merged server copy.
 */
export function usePractice() {
  const [, force] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getCache();
    setReady(true);
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    if (!syncedThisLoad) {
      syncedThisLoad = true;
      void syncNow();
    }
    const onOnline = () => void syncNow();
    window.addEventListener('online', onOnline);
    return () => {
      listeners.delete(fn);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const c = ready ? getCache() : EMPTY;
  return {
    ready,
    reviews: c.reviews,
    sessions: c.sessions,
    pendingCount: c.pendingReviews.length + c.pendingSessions.length,
    status,
  };
}
