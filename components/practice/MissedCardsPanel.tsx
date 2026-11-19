'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Play, RotateCcw } from 'lucide-react';
import { ACTIVE_LANGS, type PracticeCard, type ReviewRow } from '@/lib/practice/types';
import { KIND_LABEL } from './exercises';
import { CodeBlock, LangChip, palette } from './ui';

const MAX_MISSED_CARDS = 20;

export interface MissedCardEntry {
  card: PracticeCard;
  review: ReviewRow;
  lapses: number;
  isRelearning: boolean;
}

function lastReviewedMs(review: ReviewRow): number {
  const raw = review.fsrs.last_review ?? review.updated_at;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Filter active-language cards that have been missed (lapses > 0 or FSRS
 * Relearning state === 3), ordered by most lapses first, then most recently
 * reviewed, capped at `limit`.
 */
export function getMissedCards(
  cards: PracticeCard[],
  reviews: Record<string, ReviewRow>,
  limit = MAX_MISSED_CARDS
): MissedCardEntry[] {
  const entries: MissedCardEntry[] = [];
  for (const card of cards) {
    if (!ACTIVE_LANGS.includes(card.lang)) continue;
    const review = reviews[card.id];
    if (!review?.fsrs) continue;
    const lapses = review.fsrs.lapses ?? 0;
    const isRelearning = review.fsrs.state === 3;
    if (lapses > 0 || isRelearning) {
      entries.push({ card, review, lapses, isRelearning });
    }
  }
  entries.sort((a, b) => {
    if (b.lapses !== a.lapses) return b.lapses - a.lapses;
    return lastReviewedMs(b.review) - lastReviewedMs(a.review);
  });
  return entries.slice(0, limit);
}

function CardReadOnlyBody({ card, isDusk }: { card: PracticeCard; isDusk: boolean }) {
  const p = palette(isDusk);
  switch (card.kind) {
    case 'output':
      return (
        <div className="space-y-2.5">
          <CodeBlock code={card.code} />
          <div className={`rounded-xl p-3 border ${p.good}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Correct answer</span>
            </div>
            <div className="font-mono text-[12px] whitespace-pre-wrap break-words">
              {card.choices[card.answer] ?? ''}
            </div>
          </div>
        </div>
      );
    case 'bug': {
      const lineWidth = String(card.lines.length).length;
      const numberedCode = card.lines
        .map((line, i) => `${String(i + 1).padStart(lineWidth, ' ')}  ${line}`)
        .join('\n');
      return (
        <div className="space-y-2.5">
          <CodeBlock code={numberedCode} />
          <div className={`rounded-xl p-3 border ${p.good}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Bug on line {card.bugLine + 1}</span>
            </div>
            <div className="font-mono text-[12px] whitespace-pre-wrap break-words">
              {card.lines[card.bugLine] ?? ''}
            </div>
            {card.fixedLine !== undefined && (
              <div className={`mt-2 pt-2 border-t ${isDusk ? 'border-emerald-600/40' : 'border-emerald-400/60'}`}>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5">Fixed line</div>
                <div className="font-mono text-[12px] whitespace-pre-wrap break-words">{card.fixedLine}</div>
              </div>
            )}
          </div>
        </div>
      );
    }
    case 'order':
      return (
        <div className="space-y-1.5">
          <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${p.muted}`}>
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>Correct order</span>
          </div>
          <CodeBlock code={card.lines.join('\n')} />
        </div>
      );
    case 'compare': {
      const correctChoice = card.choices[card.answer];
      return (
        <div className="space-y-1.5">
          <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${p.muted}`}>
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>Correct answer</span>
          </div>
          <CodeBlock code={correctChoice?.code ?? ''} />
        </div>
      );
    }
  }
}

export default function MissedCardsPanel({
  cards,
  reviews,
  ready,
  isDusk,
  onPractice,
}: {
  cards: PracticeCard[];
  reviews: Record<string, ReviewRow>;
  ready: boolean;
  isDusk: boolean;
  onPractice: (cardIds: string[]) => void;
}) {
  const p = palette(isDusk);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const missed = useMemo(() => (ready ? getMissedCards(cards, reviews) : []), [ready, cards, reviews]);

  return (
    <section className={`rounded-2xl border overflow-hidden ${p.panel}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 p-4 min-h-[48px] touch-manipulation"
      >
        <span className={`text-sm font-bold flex items-center gap-2 ${p.strong}`}>
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span>Cards to revisit</span>
          {ready && missed.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tabular-nums ${p.chipIdle}`}>
              {missed.length}
            </span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${p.muted}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {missed.length === 0 ? (
                <div className={`rounded-xl p-4 border text-center space-y-1 ${p.soft}`}>
                  <p className={`text-sm font-bold ${p.strong}`}>No missed cards yet</p>
                  <p className={`text-xs ${p.muted}`}>Cards you miss in a session will appear here to review anytime.</p>
                </div>
              ) : (
                <>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onPractice(missed.map((entry) => entry.card.id))}
                    className="w-full min-h-[48px] rounded-2xl text-sm font-black text-white bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 shadow-md shadow-rose-500/20 touch-manipulation inline-flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 shrink-0" />
                    <span>Practice these</span>
                  </motion.button>

                  <div className="space-y-2">
                    {missed.map(({ card, lapses, isRelearning }) => {
                      const isExpanded = expandedId === card.id;
                      const lapseLabel = `${lapses} ${lapses === 1 ? 'lapse' : 'lapses'}`;
                      return (
                        <div key={card.id} className={`rounded-2xl border overflow-hidden ${p.soft}`}>
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : card.id)}
                            aria-expanded={isExpanded}
                            className="w-full text-left px-3.5 py-3 min-h-[52px] flex items-center gap-3 touch-manipulation"
                          >
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                {ACTIVE_LANGS.length > 1 && <LangChip lang={card.lang} isDusk={isDusk} small />}
                                <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${p.muted}`}>
                                  {card.topic}
                                </span>
                                {isRelearning && (
                                  <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${p.bad}`}>
                                    Relearning
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs font-semibold truncate ${p.strong}`}>{card.prompt}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tabular-nums ${p.chipIdle}`}>
                                {lapseLabel}
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${p.muted}`}
                              />
                            </div>
                          </button>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <div className={`px-3.5 pb-3.5 pt-2.5 border-t space-y-3 ${isDusk ? 'border-white/10' : 'border-black/5'}`}>
                                  <div className="space-y-1">
                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${p.muted}`}>
                                      {KIND_LABEL[card.kind]}
                                    </div>
                                    <p className={`text-sm font-bold leading-snug ${p.strong}`}>{card.prompt}</p>
                                  </div>

                                  <CardReadOnlyBody card={card} isDusk={isDusk} />

                                  <div className={`rounded-xl p-3 border ${p.panel}`}>
                                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${p.muted}`}>
                                      Explanation
                                    </div>
                                    <p className={`text-[12px] leading-relaxed font-medium ${p.body}`}>{card.explanation}</p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
