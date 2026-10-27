'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { LANG_META, type Lang } from '@/lib/practice/types';

/**
 * Shared pieces for the Practice feature. Code blocks stay dark in both
 * themes (like the lab terminals); everything else follows paper/dusk.
 */

export function palette(isDusk: boolean) {
  return {
    page: isDusk ? 'bg-[#1E1B29] text-[#EAE6F2]' : 'bg-[#E5DFD3] text-[#2A2623]',
    panel: isDusk ? 'bg-[#2A263A] border-[#3E3852]' : 'bg-[#EDE8DF] border-[#D2C9B8]',
    soft: isDusk ? 'bg-[#161320]/70 border-white/10' : 'bg-[#EFECE6]/90 border-black/5',
    strong: isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]',
    body: isDusk ? 'text-[#D4CDE4]' : 'text-[#443E38]',
    muted: isDusk ? 'text-[#B3ACC5]' : 'text-[#5A544E]',
    faint: isDusk ? 'text-[#7d7691]' : 'text-[#8a8378]',
    track: isDusk ? 'bg-[#1E1B29] border-[#342F46]' : 'bg-[#DCD5C9] border-[#CEC5B4]',
    chipIdle: isDusk
      ? 'bg-[#2A263A] text-[#D5CEE6] border-[#3E3852] hover:bg-[#353048]'
      : 'bg-[#EDE8DF] text-[#5A544E] border-[#D2C9B8] hover:bg-[#E2DBD0]',
    chipActive: isDusk ? 'bg-[#F0ECF8] text-[#1E1B29] border-[#F0ECF8]' : 'bg-[#2A2623] text-[#FAF7F2] border-[#2A2623]',
    good: isDusk ? 'bg-emerald-950/60 border-emerald-600/70 text-emerald-100' : 'bg-emerald-100 border-emerald-400 text-emerald-950',
    bad: isDusk ? 'bg-rose-950/60 border-rose-600/70 text-rose-100' : 'bg-rose-100 border-rose-400 text-rose-950',
  };
}

const LANG_STYLE: Record<Lang, { paper: string; dusk: string }> = {
  python: { paper: 'bg-[#DEE9F2] text-[#1B4366] border-[#B9D0E4]', dusk: 'bg-sky-950/70 text-sky-300 border-sky-700/60' },
  c: { paper: 'bg-[#E6E1F0] text-[#3D2E5E] border-[#C8BFE0]', dusk: 'bg-violet-950/70 text-violet-300 border-violet-700/60' },
  js: { paper: 'bg-amber-100 text-amber-900 border-amber-300', dusk: 'bg-amber-950/60 text-amber-300 border-amber-700/60' },
  java: { paper: 'bg-[#F2E2DA] text-[#5C2E1B] border-[#E0C2B4]', dusk: 'bg-rose-950/70 text-rose-300 border-rose-700/60' },
};

export function LangChip({ lang, isDusk, small }: { lang: Lang; isDusk: boolean; small?: boolean }) {
  const meta = LANG_META[lang];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold ${small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${
        isDusk ? LANG_STYLE[lang].dusk : LANG_STYLE[lang].paper
      }`}
    >
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}

/** Dark, horizontally scrollable code block. Whitespace is preserved exactly. */
export function CodeBlock({ code, className = '' }: { code: string; className?: string }) {
  return (
    <pre
      className={`rounded-2xl border border-[#2b2838] bg-[#12101a] text-[#e4def2] font-mono text-[12px] leading-relaxed p-3.5 overflow-x-auto whitespace-pre ${className}`}
    >
      <code>{code}</code>
    </pre>
  );
}

export type ChoiceState = 'idle' | 'correct' | 'wrong' | 'dimmed';

/** One tappable answer. After the answer is revealed it shows right/wrong. */
export function ChoiceButton({
  children,
  state,
  onClick,
  disabled,
  isDusk,
  mono = true,
  footer,
}: {
  children: React.ReactNode;
  state: ChoiceState;
  onClick?: () => void;
  disabled?: boolean;
  isDusk: boolean;
  mono?: boolean;
  footer?: React.ReactNode;
}) {
  const p = palette(isDusk);
  const tone =
    state === 'correct'
      ? p.good
      : state === 'wrong'
      ? p.bad
      : state === 'dimmed'
      ? `${p.panel} opacity-60`
      : `${p.panel} ${isDusk ? 'hover:bg-[#353048]' : 'hover:bg-[#E2DBD0]'}`;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      animate={state === 'wrong' ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.35 }}
      className={`w-full text-left rounded-2xl border px-3.5 py-3 min-h-[48px] touch-manipulation transition-colors disabled:cursor-default ${tone}`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`flex-1 min-w-0 ${mono ? 'font-mono text-[12px] whitespace-pre-wrap break-words' : 'text-sm font-semibold'}`}>
          {children}
        </div>
        {state === 'correct' && <Check className="w-4 h-4 shrink-0 mt-0.5" />}
        {state === 'wrong' && <X className="w-4 h-4 shrink-0 mt-0.5" />}
      </div>
      {footer}
    </motion.button>
  );
}

/** Segmented progress bar (weekly goal). */
export function GoalBar({ done, goal, isDusk }: { done: number; goal: number; isDusk: boolean }) {
  return (
    <div className="flex gap-1.5" aria-label={`${Math.min(done, goal)} of ${goal} sessions this week`}>
      {Array.from({ length: goal }, (_, i) => (
        <div key={i} className={`flex-1 h-2 rounded-full overflow-hidden border ${palette(isDusk).track}`}>
          <motion.div
            className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500"
            initial={false}
            animate={{ width: i < done ? '100%' : '0%' }}
            transition={{ duration: 0.35, delay: i * 0.05, ease: 'easeOut' }}
          />
        </div>
      ))}
    </div>
  );
}
