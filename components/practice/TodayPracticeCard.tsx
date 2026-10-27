'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GraduationCap, ChevronRight } from 'lucide-react';
import { ALL_CARDS } from '@/lib/practice/cards';
import { computeStats } from '@/lib/practice/scheduler';
import { usePractice } from '@/lib/practice/store';
import { usePracticeSettings } from '@/lib/practice/settings';
import { LANGS } from '@/lib/practice/types';
import { GoalBar, palette } from './ui';

/**
 * "Today's practice" card at the top of the feed. Rides on the habit of
 * opening the morning digest instead of relying on notifications.
 */
export default function TodayPracticeCard({ isDusk }: { isDusk: boolean }) {
  const p = palette(isDusk);
  const { ready, reviews, sessions } = usePractice();
  const { settings } = usePracticeSettings();

  if (!ready) return null;

  const stats = computeStats(ALL_CARDS, reviews, sessions);
  const unseen = LANGS.filter((l) => settings.weights[l] > 0).reduce((sum, l) => sum + stats.perLang[l].unseen, 0);
  const newReady = Math.min(unseen, settings.newPerSession);
  const headline =
    stats.dueTotal > 0
      ? `${stats.dueTotal} card${stats.dueTotal === 1 ? '' : 's'} due`
      : newReady > 0
      ? `${newReady} new card${newReady === 1 ? '' : 's'} ready`
      : 'All caught up';
  const nothingToDo = stats.dueTotal === 0 && newReady === 0;
  const quick = stats.practicedToday ? 2 : 5;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      aria-label="Today's practice"
      className={`rounded-3xl p-4 border-2 ${isDusk ? 'bg-[#211d2e] border-[#3E3852]' : 'bg-[#efe9df] border-[#D2C9B8]'}`}
    >
      <Link href="/practice" className="flex items-center gap-3 mb-3 touch-manipulation">
        <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] font-bold uppercase tracking-wider ${p.muted}`}>
            Today&apos;s practice{stats.practicedToday && ' · ✓ done today'}
          </div>
          <div className={`text-[15px] font-extrabold tracking-tight ${p.strong}`}>{headline}</div>
        </div>
        <ChevronRight className={`w-5 h-5 shrink-0 ${p.muted}`} />
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <GoalBar done={stats.weekSessions} goal={settings.weeklyGoal} isDusk={isDusk} />
          <div className={`text-[11px] font-semibold ${p.faint}`}>
            {Math.min(stats.weekSessions, settings.weeklyGoal)}/{settings.weeklyGoal} sessions this week
          </div>
        </div>
        {!nothingToDo && (
          <Link
            href={`/practice?start=${quick}`}
            className="shrink-0 inline-flex items-center justify-center px-4 min-h-[44px] rounded-2xl text-xs font-black text-white bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 shadow-md shadow-rose-500/20 touch-manipulation active:scale-95 transition-transform"
          >
            {stats.practicedToday ? '+2 min' : 'Start 5 min'}
          </Link>
        )}
      </div>
    </motion.section>
  );
}
