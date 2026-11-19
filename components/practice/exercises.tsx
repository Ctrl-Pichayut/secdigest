'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { BugCard, CompareCard, OrderCard, OutputCard, PracticeCard } from '@/lib/practice/types';
import { ChoiceButton, CODE_FOCUS_RING, CodeBlock, LangChip, palette, type ChoiceState } from './ui';

/**
 * The four tap-only exercise types. Each one owns its answer state and calls
 * onAnswered exactly once; the session runner shows the explanation and the
 * rating buttons. Parents key these by card + attempt so state resets.
 */

interface ExerciseProps<T extends PracticeCard> {
  card: T;
  isDusk: boolean;
  onAnswered: (correct: boolean) => void;
}

function shuffledIndexes(n: number, avoidIdentity: boolean): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    if (!avoidIdentity || n < 2 || idx.some((v, i) => v !== i)) break;
  }
  return idx;
}

function choiceState(i: number, picked: number | null, answer: number): ChoiceState {
  if (picked === null) return 'idle';
  if (i === answer) return 'correct';
  if (i === picked) return 'wrong';
  return 'dimmed';
}

function OutputExercise({ card, isDusk, onAnswered }: ExerciseProps<OutputCard>) {
  const [order] = useState(() => shuffledIndexes(card.choices.length, false));
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    onAnswered(i === card.answer);
  };
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });

  useEffect(() => {
    if (picked !== null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key >= '1' && e.key <= '4') {
        const slot = Number(e.key) - 1;
        if (slot < order.length) {
          e.preventDefault();
          pickRef.current(order[slot]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [order, picked]);

  return (
    <div className="space-y-3">
      <CodeBlock code={card.code} />
      <div className="space-y-2">
        {order.map((i, slot) => (
          <ChoiceButton
            key={i}
            state={choiceState(i, picked, card.answer)}
            disabled={picked !== null}
            onClick={() => pick(i)}
            isDusk={isDusk}
            keyShortcut={slot < 4 ? String(slot + 1) : undefined}
          >
            {card.choices[i]}
          </ChoiceButton>
        ))}
      </div>
    </div>
  );
}

function CompareExercise({ card, isDusk, onAnswered }: ExerciseProps<CompareCard>) {
  const p = palette(isDusk);
  const [order] = useState(() => shuffledIndexes(card.choices.length, false));
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    onAnswered(i === card.answer);
  };
  return (
    <div className="space-y-2">
      {order.map((i) => {
        const choice = card.choices[i];
        return (
          <ChoiceButton
            key={i}
            state={choiceState(i, picked, card.answer)}
            disabled={picked !== null}
            onClick={() => pick(i)}
            isDusk={isDusk}
            footer={
              picked !== null && (
                <div className={`mt-1.5 text-[11px] font-bold ${i === card.answer || i === picked ? '' : p.muted}`}>
                  {choice.lang ? <LangChip lang={choice.lang} isDusk={isDusk} small /> : 'Not valid in any of the four'}
                </div>
              )
            }
          >
            {choice.code}
          </ChoiceButton>
        );
      })}
    </div>
  );
}

function BugExercise({ card, isDusk, onAnswered }: ExerciseProps<BugCard>) {
  const p = palette(isDusk);
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    onAnswered(i === card.bugLine);
  };
  return (
    <div className="space-y-2">
      <div className={`text-[11px] font-semibold ${p.muted}`}>Tap the line with the bug</div>
      <div className="rounded-2xl border border-[#2b2838] bg-[#12101a] py-2 overflow-x-auto">
        <div className="min-w-max">
          {card.lines.map((line, i) => {
            const isBug = i === card.bugLine;
            const revealed = picked !== null;
            const tone = !revealed
              ? 'hover:bg-white/5 active:bg-white/10'
              : isBug
              ? 'bg-emerald-500/20 shadow-[inset_3px_0_0_#34d399]'
              : i === picked
              ? 'bg-rose-500/20 shadow-[inset_3px_0_0_#fb7185]'
              : 'opacity-50';
            return (
              <motion.button
                key={i}
                type="button"
                disabled={revealed}
                onClick={() => pick(i)}
                animate={revealed && i === picked && !isBug ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                transition={{ duration: 0.35 }}
                className={`w-full flex items-center text-left font-mono text-[12px] leading-relaxed min-h-[44px] touch-manipulation transition-colors disabled:cursor-default ${CODE_FOCUS_RING} ${tone}`}
              >
                <span className="w-9 shrink-0 text-right pr-3 py-2 text-[#6f6a85] select-none">{i + 1}</span>
                <span className="pr-4 py-2 whitespace-pre text-[#e4def2]">{line || ' '}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Indentation only matters in Python; in C, JS and Java two closing braces are interchangeable. */
function sameLine(card: OrderCard, a: string, b: string): boolean {
  return card.lang === 'python' ? a === b : a.trim() === b.trim();
}

function OrderExercise({ card, isDusk, onAnswered }: ExerciseProps<OrderCard>) {
  const p = palette(isDusk);
  const [pool, setPool] = useState<number[]>(() => shuffledIndexes(card.lines.length, true));
  const [built, setBuilt] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const locked = result !== null;

  const place = (idx: number) => {
    if (locked) return;
    setPool((prev) => prev.filter((i) => i !== idx));
    setBuilt((prev) => [...prev, idx]);
  };
  const unplace = (idx: number) => {
    if (locked) return;
    setBuilt((prev) => prev.filter((i) => i !== idx));
    setPool((prev) => [...prev, idx]);
  };
  const moveBuilt = (pos: number, delta: -1 | 1) => {
    if (locked) return;
    const target = pos + delta;
    setBuilt((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[pos], next[target]] = [next[target], next[pos]];
      return next;
    });
  };
  const clear = () => {
    if (locked) return;
    setPool((prev) => [...prev, ...built]);
    setBuilt([]);
  };
  const check = () => {
    // Compare text, not line identity, so identical lines (like two closing braces) can swap freely.
    const correct = built.length === card.lines.length && built.every((idx, pos) => sameLine(card, card.lines[idx], card.lines[pos]));
    setResult(correct);
    onAnswered(correct);
  };

  return (
    <div className="space-y-3">
      {/* The code being built */}
      <div className="rounded-2xl border border-[#2b2838] bg-[#12101a] py-2 min-h-[96px] overflow-hidden">
        {built.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-[#6f6a85]">Tap the lines below in order</div>
        ) : (
          <div>
            {built.map((idx, pos) => {
              const ok = sameLine(card, card.lines[idx], card.lines[pos]);
              const tone = !locked
                ? ''
                : ok
                ? 'bg-emerald-500/15 shadow-[inset_3px_0_0_#34d399]'
                : 'bg-rose-500/15 shadow-[inset_3px_0_0_#fb7185]';
              return (
                <motion.div
                  key={idx}
                  layout
                  layoutId={`${card.id}-line-${idx}`}
                  className={`w-full flex items-stretch min-h-[44px] transition-colors ${tone}`}
                >
                  <button
                    type="button"
                    onClick={() => unplace(idx)}
                    disabled={locked}
                    aria-label={locked ? undefined : `Remove line ${pos + 1}: ${card.lines[idx].trim() || 'blank line'}`}
                    className={`flex-1 min-w-0 flex items-center text-left font-mono text-[12px] leading-relaxed min-h-[44px] overflow-x-auto touch-manipulation transition-colors enabled:hover:bg-white/5 disabled:cursor-default ${CODE_FOCUS_RING}`}
                  >
                    <span className="w-9 shrink-0 text-right pr-3 py-2 text-[#6f6a85] select-none">{pos + 1}</span>
                    <span className="pr-3 py-2 whitespace-pre text-[#e4def2]">{card.lines[idx] || ' '}</span>
                  </button>
                  {!locked && (
                    <div className="shrink-0 flex items-center border-l border-[#2b2838]">
                      <button
                        type="button"
                        onClick={() => moveBuilt(pos, -1)}
                        disabled={pos === 0}
                        aria-label={`Move line ${pos + 1} up`}
                        className={`w-11 h-11 shrink-0 flex items-center justify-center text-[#9d96b3] enabled:hover:text-[#e4def2] enabled:hover:bg-white/10 enabled:active:bg-white/15 disabled:opacity-30 disabled:cursor-default touch-manipulation transition-colors ${CODE_FOCUS_RING}`}
                      >
                        <ChevronUp className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBuilt(pos, 1)}
                        disabled={pos === built.length - 1}
                        aria-label={`Move line ${pos + 1} down`}
                        className={`w-11 h-11 shrink-0 flex items-center justify-center text-[#9d96b3] enabled:hover:text-[#e4def2] enabled:hover:bg-white/10 enabled:active:bg-white/15 disabled:opacity-30 disabled:cursor-default touch-manipulation transition-colors ${CODE_FOCUS_RING}`}
                      >
                        <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Remaining lines */}
      {pool.length > 0 && (
        <div className="space-y-1.5">
          {pool.map((idx) => (
            <motion.button
              key={idx}
              layoutId={`${card.id}-line-${idx}`}
              type="button"
              onClick={() => place(idx)}
              whileTap={{ scale: 0.98 }}
              className={`w-full text-left rounded-xl border px-3 py-2.5 min-h-[44px] font-mono text-[12px] whitespace-pre overflow-x-auto touch-manipulation ${p.panel} ${p.strong} ${p.focusRing}`}
            >
              {card.lines[idx]}
            </motion.button>
          ))}
        </div>
      )}

      {!locked && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clear}
            disabled={built.length === 0}
            className={`inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-xl border text-xs font-bold touch-manipulation disabled:opacity-40 ${p.chipIdle} ${p.focusRing}`}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Clear
          </button>
          <motion.button
            type="button"
            onClick={check}
            disabled={pool.length > 0}
            whileTap={pool.length > 0 ? undefined : { scale: 0.97 }}
            className={`flex-1 min-h-[44px] rounded-xl text-xs font-bold text-white bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 shadow-md shadow-rose-500/20 touch-manipulation disabled:opacity-40 ${p.focusRing}`}
          >
            {pool.length > 0 ? `${pool.length} line${pool.length === 1 ? '' : 's'} left` : 'Check'}
          </motion.button>
        </div>
      )}

      {result === false && (
        <div className="space-y-1.5">
          <div className={`text-[11px] font-bold ${p.muted}`}>Correct order</div>
          <CodeBlock code={card.lines.join('\n')} />
        </div>
      )}
    </div>
  );
}

export function Exercise({ card, isDusk, onAnswered }: ExerciseProps<PracticeCard>) {
  switch (card.kind) {
    case 'output':
      return <OutputExercise card={card} isDusk={isDusk} onAnswered={onAnswered} />;
    case 'compare':
      return <CompareExercise card={card} isDusk={isDusk} onAnswered={onAnswered} />;
    case 'bug':
      return <BugExercise card={card} isDusk={isDusk} onAnswered={onAnswered} />;
    case 'order':
      return <OrderExercise card={card} isDusk={isDusk} onAnswered={onAnswered} />;
  }
}

export const KIND_LABEL: Record<PracticeCard['kind'], string> = {
  output: 'Predict the output',
  compare: 'Which language?',
  bug: 'Spot the bug',
  order: 'Reorder the lines',
};
