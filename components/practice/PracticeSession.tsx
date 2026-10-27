'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { Rating, type Grade } from 'ts-fsrs';
import { ALL_CARDS } from '@/lib/practice/cards';
import { computeStats, rateCard, type SessionItem } from '@/lib/practice/scheduler';
import { newSessionId, recordReview, recordSession, usePractice } from '@/lib/practice/store';
import type { SessionMode } from '@/lib/practice/types';
import { useFeedback } from '@/lib/ctf/feedback';
import { Exercise, KIND_LABEL } from './exercises';
import { GoalBar, LangChip, palette } from './ui';

interface QueueItem extends SessionItem {
  /** True for the second attempt at a card missed earlier in this session. */
  retry: boolean;
}

const GRADES: { grade: Grade; label: string; hint: string }[] = [
  { grade: Rating.Hard, label: 'Hard', hint: 'Needed a guess' },
  { grade: Rating.Good, label: 'Good', hint: 'Got it' },
  { grade: Rating.Easy, label: 'Easy', hint: 'Too easy' },
];

export default function PracticeSession({
  items,
  minutes,
  mode,
  isDusk,
  weeklyGoal,
  onClose,
  onAnother,
}: {
  items: SessionItem[];
  minutes: number;
  mode: SessionMode;
  isDusk: boolean;
  weeklyGoal: number;
  onClose: () => void;
  onAnother: (minutes: number) => void;
}) {
  const p = palette(isDusk);
  const { reviews, sessions } = usePractice();
  const { cue } = useFeedback();
  const [queue, setQueue] = useState<QueueItem[]>(() => items.map((it) => ({ ...it, retry: false })));
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stats, setStats] = useState({ reviewed: 0, correct: 0, newCards: 0 });
  const [done, setDone] = useState(items.length === 0);
  const startedAt = useRef(new Date().toISOString());
  const sessionId = useRef(newSessionId());
  const recorded = useRef(false);
  const revealRef = useRef<HTMLDivElement>(null);

  // Lock page scroll behind the overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (answer !== null) {
      requestAnimationFrame(() => revealRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }
  }, [answer]);

  const save = (finalStats: typeof stats) => {
    if (recorded.current || finalStats.reviewed === 0) return;
    recorded.current = true;
    recordSession({
      id: sessionId.current,
      started_at: startedAt.current,
      finished_at: new Date().toISOString(),
      minutes,
      mode,
      reviewed: finalStats.reviewed,
      new_cards: finalStats.newCards,
      correct: finalStats.correct,
    });
  };

  const close = () => {
    save(stats);
    onClose();
  };

  const current = queue[pos];

  const onAnswered = (correct: boolean) => {
    setAnswer(correct);
    cue(correct ? 'step' : 'error');
  };

  const rate = (grade: Grade) => {
    if (!current || answer === null) return;
    recordReview(rateCard(current.card, reviews[current.card.id], grade));

    // Only first attempts count toward the score; a miss gets one retry at the end.
    const nextStats = current.retry
      ? stats
      : {
          reviewed: stats.reviewed + 1,
          correct: stats.correct + (answer ? 1 : 0),
          newCards: stats.newCards + (current.isNew ? 1 : 0),
        };
    const nextQueue = !answer && !current.retry ? [...queue, { ...current, isNew: false, retry: true }] : queue;
    setStats(nextStats);
    setQueue(nextQueue);

    if (pos + 1 < nextQueue.length) {
      setPos(pos + 1);
      setAnswer(null);
      setAttempt((n) => n + 1);
    } else {
      save(nextStats);
      setDone(true);
      cue('success');
    }
  };

  const weekSessions = computeStats(ALL_CARDS, reviews, sessions).weekSessions;
  const progress = queue.length > 0 ? (pos + (answer !== null ? 1 : 0)) / queue.length : 1;

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto overscroll-contain ${p.page}`}>
      <div className="max-w-md mx-auto min-h-full flex flex-col">
        {/* Top bar */}
        <div className={`sticky top-0 z-10 px-4 pt-4 pb-3 backdrop-blur-md ${isDusk ? 'bg-[#1E1B29]/95' : 'bg-[#E5DFD3]/95'}`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={close}
              aria-label="End session"
              className={`w-11 h-11 shrink-0 rounded-2xl border flex items-center justify-center touch-manipulation ${p.chipIdle}`}
            >
              <X className="w-4 h-4" />
            </button>
            <div className={`flex-1 h-2.5 rounded-full overflow-hidden border ${p.track}`}>
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500 rounded-full"
                initial={false}
                animate={{ width: `${(done ? 1 : progress) * 100}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
            <span className={`text-xs font-bold tabular-nums w-12 text-right ${p.muted}`}>
              {done ? queue.length : Math.min(pos + 1, queue.length)}/{queue.length}
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 px-5 pt-6 pb-10 flex flex-col"
            >
              {stats.reviewed === 0 ? (
                <div className="text-center space-y-2 pt-10">
                  <div className="text-4xl">🌿</div>
                  <h2 className={`text-xl font-black ${p.strong}`}>Nothing to practice right now</h2>
                  <p className={`text-sm ${p.muted}`}>Everything is scheduled for later. Come back tomorrow.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="text-center space-y-1.5">
                    <motion.div
                      className="text-5xl"
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                    >
                      {stats.correct === stats.reviewed ? '🏆' : stats.correct / stats.reviewed >= 0.6 ? '🎉' : '💪'}
                    </motion.div>
                    <h2 className={`text-2xl font-black tracking-tight ${p.strong}`}>Session done</h2>
                    <p className={`text-sm ${p.muted}`}>
                      {stats.correct} of {stats.reviewed} right on the first try
                      {stats.newCards > 0 && ` · ${stats.newCards} new card${stats.newCards === 1 ? '' : 's'}`}
                    </p>
                  </div>

                  <div className={`rounded-2xl p-4 border space-y-2.5 ${p.panel}`}>
                    <div className={`flex items-center justify-between text-xs font-bold ${p.strong}`}>
                      <span>This week</span>
                      <span className={p.muted}>
                        {Math.min(weekSessions, weeklyGoal)} of {weeklyGoal} sessions
                        {weekSessions >= weeklyGoal && ' · goal reached 🎯'}
                      </span>
                    </div>
                    <GoalBar done={weekSessions} goal={weeklyGoal} isDusk={isDusk} />
                  </div>

                  <p className={`text-xs text-center leading-relaxed ${p.faint}`}>
                    Missed cards come back soon, and the ones you know will wait longer each time.
                  </p>
                </div>
              )}

              <div className="mt-auto pt-8 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className={`min-h-[52px] rounded-2xl border text-sm font-bold touch-manipulation ${p.chipIdle}`}
                >
                  Done
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onAnother(2)}
                  className="min-h-[52px] rounded-2xl text-sm font-bold text-white bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 shadow-md shadow-rose-500/20 touch-manipulation"
                >
                  +2 minutes
                </motion.button>
              </div>
            </motion.div>
          ) : (
            current && (
              <motion.div
                key={attempt}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex-1 px-4 pb-4 space-y-3.5"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <LangChip lang={current.card.lang} isDusk={isDusk} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${p.muted}`}>
                    {KIND_LABEL[current.card.kind]} · {current.card.topic}
                  </span>
                  {current.isNew && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-tr from-amber-500 to-rose-500 text-white">
                      <Sparkles className="w-3 h-3" /> New
                    </span>
                  )}
                  {current.retry && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${p.chipIdle}`}>Second try</span>
                  )}
                </div>

                <h2 className={`text-[17px] font-extrabold leading-snug tracking-tight ${p.strong}`}>{current.card.prompt}</h2>

                <Exercise key={attempt} card={current.card} isDusk={isDusk} onAnswered={onAnswered} />

                {answer !== null && (
                  <motion.div
                    ref={revealRef}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl p-3.5 border scroll-mb-40 ${answer ? p.good : p.bad}`}
                  >
                    <div className="text-sm font-black mb-1">{answer ? 'Correct ✓' : 'Not quite'}</div>
                    <p className="text-[13px] leading-relaxed font-medium">{current.card.explanation}</p>
                  </motion.div>
                )}
              </motion.div>
            )
          )}
        </AnimatePresence>

        {/* Thumb-height rating bar */}
        {!done && answer !== null && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`sticky bottom-0 px-4 pt-3 pb-4 border-t backdrop-blur-md ${isDusk ? 'bg-[#1E1B29]/95 border-[#342F46]' : 'bg-[#E5DFD3]/95 border-[#D2C9B8]'}`}
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            {answer ? (
              <div className="grid grid-cols-3 gap-2">
                {GRADES.map(({ grade, label, hint }) => (
                  <motion.button
                    key={label}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => rate(grade)}
                    className={`min-h-[56px] rounded-2xl text-sm font-bold touch-manipulation flex flex-col items-center justify-center ${
                      grade === Rating.Good
                        ? 'text-white bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 shadow-md shadow-rose-500/20'
                        : `border ${p.chipIdle}`
                    }`}
                  >
                    {label}
                    <span className="text-[10px] font-semibold opacity-80">{hint}</span>
                  </motion.button>
                ))}
              </div>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => rate(Rating.Again)}
                className="w-full min-h-[56px] rounded-2xl text-sm font-bold text-white bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 shadow-md shadow-rose-500/20 touch-manipulation"
              >
                Continue{current && !current.retry ? ' · you’ll see it again at the end' : ''}
              </motion.button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
