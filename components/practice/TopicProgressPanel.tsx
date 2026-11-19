'use client';

import React, { useId, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { computeTopicProgress, type TopicProgress } from '@/lib/practice/scheduler';
import type { Lang, PracticeCard, ReviewRow } from '@/lib/practice/types';
import { LangChip, palette } from './ui';

const VISIBLE_TOPICS = 4;

function TopicRow({
  topic,
  isDusk,
  showNextUp,
}: {
  topic: TopicProgress;
  isDusk: boolean;
  showNextUp: boolean;
}) {
  const p = palette(isDusk);
  const pct = topic.total > 0 ? Math.round((topic.seen / topic.total) * 100) : 0;
  const nextUpTone = isDusk
    ? 'bg-amber-950/70 text-amber-200 border-amber-600/70'
    : 'bg-amber-100 text-amber-950 border-amber-400';

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-xs font-bold leading-snug ${p.strong}`}>{topic.topic}</span>
          {showNextUp && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold leading-none shrink-0 ${nextUpTone}`}
            >
              Next up
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-[11px] tabular-nums">
          <span className={`font-bold ${p.body}`}>
            {topic.seen}/{topic.total}
          </span>
          {topic.firstTryPct !== null && (
            <>
              <span className={p.muted} aria-hidden="true">
                ·
              </span>
              <span className={`font-semibold ${p.muted}`}>{topic.firstTryPct}% first-try</span>
            </>
          )}
        </div>
      </div>
      <div
        className={`h-1.5 rounded-full overflow-hidden border ${p.track}`}
        role="progressbar"
        aria-valuenow={topic.seen}
        aria-valuemin={0}
        aria-valuemax={topic.total}
        aria-label={`${topic.topic}: ${topic.seen} of ${topic.total} learned`}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default function TopicProgressPanel({
  cards,
  reviews,
  lang,
  isDusk,
  ready = true,
}: {
  cards: PracticeCard[];
  reviews: Record<string, ReviewRow>;
  lang: Lang;
  isDusk: boolean;
  ready?: boolean;
}) {
  const p = palette(isDusk);
  const [showAll, setShowAll] = useState(false);
  const extraId = useId();

  const topics = useMemo(() => computeTopicProgress(cards, reviews, lang), [cards, reviews, lang]);

  const { totalSeen, totalCards, totalDue } = useMemo(
    () =>
      topics.reduce(
        (acc, t) => ({
          totalSeen: acc.totalSeen + t.seen,
          totalCards: acc.totalCards + t.total,
          totalDue: acc.totalDue + t.due,
        }),
        { totalSeen: 0, totalCards: 0, totalDue: 0 }
      ),
    [topics]
  );

  const visibleTopics = topics.slice(0, VISIBLE_TOPICS);
  const hiddenTopics = topics.slice(VISIBLE_TOPICS);

  return (
    <section className={`rounded-2xl p-4 border space-y-3 ${p.panel}`} aria-label="Your progress">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className={`text-[11px] font-bold uppercase tracking-wider ${p.muted}`}>Your progress</h2>
          <LangChip lang={lang} isDusk={isDusk} small />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-sm font-black tabular-nums ${p.strong}`}>
            {totalSeen} of {totalCards} learned
          </p>
          {totalDue > 0 && (
            <span className={`text-[11px] font-semibold tabular-nums ${p.muted}`}>
              {totalDue} due
            </span>
          )}
        </div>
      </div>

      {topics.length > 0 && (
        <div className={`pt-3 border-t ${isDusk ? 'border-white/10' : 'border-black/5'}`}>
          <div className="space-y-3">
            {visibleTopics.map((topic) => (
              <TopicRow
                key={topic.topic}
                topic={topic}
                isDusk={isDusk}
                showNextUp={ready && topic.isNextUp}
              />
            ))}
          </div>

          {hiddenTopics.length > 0 && (
            <div id={extraId}>
              <AnimatePresence initial={false}>
                {showAll && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-3">
                      {hiddenTopics.map((topic) => (
                        <TopicRow
                          key={topic.topic}
                          topic={topic}
                          isDusk={isDusk}
                          showNextUp={ready && topic.isNextUp}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {hiddenTopics.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          aria-controls={extraId}
          className={`w-full min-h-[44px] px-3 rounded-xl border text-xs font-bold touch-manipulation transition-colors inline-flex items-center justify-center gap-1.5 ${p.chipIdle} ${p.focusRing}`}
        >
          <span>{showAll ? 'Show fewer topics' : 'Show all topics'}</span>
          {!showAll && (
            <span className={`tabular-nums ${p.muted}`}>({hiddenTopics.length} more)</span>
          )}
          <ChevronDown
            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
    </section>
  );
}
