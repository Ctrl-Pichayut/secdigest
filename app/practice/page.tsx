'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Cloud, CloudOff, HardDrive, Settings2, ChevronDown, Minus, Plus } from 'lucide-react';
import { useTheme } from '@/lib/ctf/useTheme';
import { ALL_CARDS } from '@/lib/practice/cards';
import { buildSession, computeStats, SESSION_SIZES, type SessionItem } from '@/lib/practice/scheduler';
import { usePractice, type SyncStatus } from '@/lib/practice/store';
import { presetIdFor, usePracticeSettings, WEIGHT_PRESETS } from '@/lib/practice/settings';
import { LANG_META, LANGS, type SessionMode } from '@/lib/practice/types';
import PracticeSession from '@/components/practice/PracticeSession';
import { GoalBar, LangChip, palette } from '@/components/practice/ui';

function SyncPill({ status, pending, isDusk }: { status: SyncStatus; pending: number; isDusk: boolean }) {
  const p = palette(isDusk);
  if (status === 'idle') return null;
  const view =
    status === 'syncing'
      ? { icon: <Cloud className="w-3.5 h-3.5 animate-pulse" />, text: 'Syncing…' }
      : status === 'synced'
      ? { icon: <Cloud className="w-3.5 h-3.5" />, text: 'Synced' }
      : status === 'local-only'
      ? { icon: <HardDrive className="w-3.5 h-3.5" />, text: 'This device only' }
      : { icon: <CloudOff className="w-3.5 h-3.5" />, text: pending > 0 ? `Offline · ${pending} to sync` : 'Offline' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${p.chipIdle}`}>
      {view.icon}
      {view.text}
    </span>
  );
}

function Stepper({ value, min, max, onChange, isDusk, label }: { value: number; min: number; max: number; onChange: (v: number) => void; isDusk: boolean; label: string }) {
  const p = palette(isDusk);
  const btn = `w-11 h-11 rounded-xl border flex items-center justify-center touch-manipulation disabled:opacity-40 ${p.chipIdle}`;
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer: ${label}`}>
        <Minus className="w-4 h-4" />
      </button>
      <span className={`w-6 text-center text-sm font-black tabular-nums ${p.strong}`}>{value}</span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More: ${label}`}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function PracticePage() {
  const { isDusk } = useTheme();
  const p = palette(isDusk);
  const { ready, reviews, sessions, status, pendingCount } = usePractice();
  const { settings, update } = usePracticeSettings();
  const [sizeIdx, setSizeIdx] = useState(1);
  const [mode, setMode] = useState<SessionMode>('mixed');
  const [showSettings, setShowSettings] = useState(false);
  const [session, setSession] = useState<{ items: SessionItem[]; minutes: number; mode: SessionMode; key: number } | null>(null);

  const stats = useMemo(() => computeStats(ALL_CARDS, reviews, sessions), [reviews, sessions]);

  const start = useCallback(
    (minutes: number, sessionMode: SessionMode) => {
      const size = SESSION_SIZES.find((s) => s.minutes === minutes) ?? SESSION_SIZES[1];
      const items = buildSession({
        cards: ALL_CARDS,
        reviews,
        mode: sessionMode,
        cardCount: size.cards,
        newLimit: settings.newPerSession,
        weights: settings.weights,
      });
      setSession({ items, minutes: size.minutes, mode: sessionMode, key: Date.now() });
    },
    [reviews, settings]
  );

  // The feed's "Today's practice" card links here with ?start=<minutes>.
  useEffect(() => {
    if (!ready) return;
    const n = Number(new URLSearchParams(window.location.search).get('start'));
    if (n > 0) {
      window.history.replaceState(null, '', '/practice');
      start(n, 'mixed');
    }
    // Only on first load, once progress is available (start is intentionally not a dependency).
  }, [ready]);

  const size = SESSION_SIZES[sizeIdx];
  const preview = useMemo(() => {
    const due = mode === 'mixed' ? stats.dueTotal : stats.perLang[mode].due;
    const unseen =
      mode === 'mixed'
        ? LANGS.filter((l) => settings.weights[l] > 0).reduce((sum, l) => sum + stats.perLang[l].unseen, 0)
        : stats.perLang[mode].unseen;
    const reviewsN = Math.min(due, size.cards);
    const newN = Math.min(unseen, settings.newPerSession, size.cards - reviewsN);
    return { reviewsN, newN, total: reviewsN + newN };
  }, [mode, stats, settings, size]);

  const presetId = presetIdFor(settings.weights);
  const modes: { id: SessionMode; label: string }[] = [
    { id: 'mixed', label: 'Mixed' },
    ...LANGS.map((l) => ({ id: l as SessionMode, label: LANG_META[l].label === 'JavaScript' ? 'JS' : LANG_META[l].label })),
  ];

  return (
    <div className={`min-h-screen w-full ${p.page}`}>
      <div className={`max-w-md mx-auto min-h-screen flex flex-col pb-28 ${isDusk ? 'bg-[#1E1B29]' : 'bg-[#E5DFD3]'}`}>
        {/* Header */}
        <header className={`px-5 pt-6 pb-4 border-b ${isDusk ? 'border-[#342F46]' : 'border-[#D2C9B8]'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h1 className={`text-2xl font-black tracking-tight leading-tight ${p.strong}`}>Practice</h1>
                <p className={`text-xs font-medium ${p.muted}`}>Keep your coding sharp, a few minutes at a time</p>
              </div>
            </div>
            {ready && <SyncPill status={status} pending={pendingCount} isDusk={isDusk} />}
          </div>

          {status === 'local-only' && (
            <p className={`mt-3 text-[11px] leading-relaxed rounded-xl px-3 py-2 border ${p.soft} ${p.body}`}>
              Progress is saved on this device. Run <span className="font-mono">supabase_phase9_practice.sql</span> in Supabase
              to back it up and sync it across devices.
            </p>
          )}

          {/* Weekly goal */}
          <div className={`mt-4 rounded-2xl p-3.5 border space-y-2.5 ${p.panel}`}>
            <div className={`flex items-center justify-between text-xs font-bold ${p.strong}`}>
              <span>
                {stats.weekSessions >= settings.weeklyGoal
                  ? 'Weekly goal reached 🎯'
                  : `${stats.weekSessions} of ${settings.weeklyGoal} sessions this week`}
              </span>
              {stats.practicedToday && (
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${p.good}`}>✓ Today</span>
              )}
            </div>
            <GoalBar done={stats.weekSessions} goal={settings.weeklyGoal} isDusk={isDusk} />
            <p className={`text-[11px] ${p.faint}`}>
              Missed days don&apos;t reset anything. Any {settings.weeklyGoal} session{settings.weeklyGoal === 1 ? '' : 's'} this week count, on any days.
            </p>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 space-y-4">
          {/* Start a session */}
          <section className={`rounded-3xl p-4 border-2 space-y-3.5 ${isDusk ? 'bg-[#211d2e] border-[#3E3852]' : 'bg-[#efe9df] border-[#D2C9B8]'}`}>
            <div>
              <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${p.muted}`}>How much time do you have?</div>
              <div className="grid grid-cols-3 gap-2">
                {SESSION_SIZES.map((s, i) => (
                  <button
                    key={s.minutes}
                    type="button"
                    onClick={() => setSizeIdx(i)}
                    aria-pressed={i === sizeIdx}
                    className={`min-h-[48px] rounded-2xl border text-sm font-black touch-manipulation transition-colors ${i === sizeIdx ? p.chipActive : p.chipIdle}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${p.muted}`}>Languages</div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    aria-pressed={m.id === mode}
                    className={`shrink-0 px-3.5 min-h-[40px] rounded-full border text-xs font-bold touch-manipulation transition-colors ${m.id === mode ? p.chipActive : p.chipIdle}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <motion.button
              type="button"
              whileTap={preview.total > 0 ? { scale: 0.97 } : undefined}
              disabled={!ready || preview.total === 0}
              onClick={() => start(size.minutes, mode)}
              className="w-full min-h-[56px] rounded-2xl text-sm font-black text-white bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 shadow-md shadow-rose-500/20 touch-manipulation disabled:opacity-50"
            >
              {!ready
                ? 'Loading…'
                : preview.total === 0
                ? 'All caught up — nothing due'
                : `Start · ${[
                    preview.reviewsN > 0 && `${preview.reviewsN} review${preview.reviewsN === 1 ? '' : 's'}`,
                    preview.newN > 0 && `${preview.newN} new`,
                  ]
                    .filter(Boolean)
                    .join(' + ')}`}
            </motion.button>
          </section>

          {/* Per-language progress */}
          <section className={`rounded-2xl p-4 border space-y-3 ${p.panel}`}>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${p.muted}`}>Your progress</div>
            {LANGS.map((lang) => {
              const s = stats.perLang[lang];
              const pct = s.total > 0 ? Math.round((s.seen / s.total) * 100) : 0;
              return (
                <div key={lang} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <LangChip lang={lang} isDusk={isDusk} small />
                    <span className={`text-[11px] font-semibold tabular-nums ${p.muted}`}>
                      {s.seen}/{s.total} learned{s.due > 0 && ` · ${s.due} due`}
                      {mode === 'mixed' && ` · ${settings.weights[lang]}% of new`}
                    </span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden border ${p.track}`}>
                    <motion.div
                      className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500"
                      initial={false}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          {/* Settings */}
          <section className={`rounded-2xl border overflow-hidden ${p.panel}`}>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
              className="w-full flex items-center justify-between p-4 min-h-[48px] touch-manipulation"
            >
              <span className={`text-sm font-bold flex items-center gap-2 ${p.strong}`}>
                <Settings2 className="w-4 h-4" />
                Settings
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showSettings ? 'rotate-180' : ''} ${p.muted}`} />
            </button>
            <AnimatePresence initial={false}>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.26, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    <div>
                      <div className={`text-xs font-bold mb-1 ${p.strong}`}>Language mix for new cards</div>
                      <p className={`text-[11px] mb-2 ${p.faint}`}>
                        Cards you&apos;ve already learned always come back when due, whatever the mix.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {WEIGHT_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => update({ weights: preset.weights })}
                            aria-pressed={preset.id === presetId}
                            className={`px-3.5 min-h-[40px] rounded-full border text-xs font-bold touch-manipulation ${preset.id === presetId ? p.chipActive : p.chipIdle}`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className={`text-xs font-bold ${p.strong}`}>Weekly goal</div>
                        <div className={`text-[11px] ${p.faint}`}>Sessions per week</div>
                      </div>
                      <Stepper label="weekly goal" value={settings.weeklyGoal} min={1} max={7} onChange={(v) => update({ weeklyGoal: v })} isDusk={isDusk} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className={`text-xs font-bold ${p.strong}`}>New cards per session</div>
                        <div className={`text-[11px] ${p.faint}`}>Lower it if reviews feel heavy</div>
                      </div>
                      <Stepper label="new cards per session" value={settings.newPerSession} min={0} max={10} onChange={(v) => update({ newPerSession: v })} isDusk={isDusk} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </main>
      </div>

      {session && (
        <PracticeSession
          key={session.key}
          items={session.items}
          minutes={session.minutes}
          mode={session.mode}
          isDusk={isDusk}
          weeklyGoal={settings.weeklyGoal}
          onClose={() => setSession(null)}
          onAnother={(minutes) => start(minutes, session.mode)}
        />
      )}
    </div>
  );
}
