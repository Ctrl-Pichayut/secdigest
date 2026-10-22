'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Vibrate } from 'lucide-react';
import { useFeedback } from '@/lib/ctf/feedback';

/**
 * Small shared primitives for the interactive labs. The "terminal" panels
 * stay dark in both themes so they read as a real console; page chrome
 * (buttons, hints) respects the paper/dusk theme via the isDusk prop.
 *
 * Animations use framer-motion and are wrapped app-wide in MotionConfig
 * reducedMotion="user", so they soften automatically for readers who ask
 * the OS to reduce motion.
 */

export function LabButton({
  children,
  onClick,
  disabled,
  tone = 'neutral',
  isDusk,
  title,
  full,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'primary' | 'danger' | 'success';
  isDusk: boolean;
  title?: string;
  full?: boolean;
}) {
  const base =
    'px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors touch-manipulation cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none min-h-[44px] flex items-center justify-center gap-1.5';
  const tones: Record<string, string> = {
    primary: 'bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 text-white shadow-md shadow-rose-500/20',
    danger: isDusk
      ? 'bg-rose-950/70 text-rose-200 border border-rose-700/60'
      : 'bg-rose-200/90 text-rose-950 border border-rose-300',
    success: isDusk
      ? 'bg-emerald-950/70 text-emerald-200 border border-emerald-700/60'
      : 'bg-emerald-200/90 text-emerald-950 border border-emerald-300',
    neutral: isDusk
      ? 'bg-[#2A263A] text-[#E2DCF0] border border-[#433D58] hover:bg-[#353048]'
      : 'bg-[#EFECE6] text-[#2A2623] border border-[#D2C9B8] hover:bg-[#E5DFD3]',
  };
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      className={`${base} ${tones[tone]} ${full ? 'w-full' : ''}`}
    >
      {children}
    </motion.button>
  );
}

export function Chip({
  children,
  onClick,
  active,
  isDusk,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  isDusk: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold font-mono transition-colors touch-manipulation cursor-pointer border min-h-[32px] ${
        active
          ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 text-white border-transparent'
          : isDusk
          ? 'bg-[#161320] text-[#B9B2CE] border-[#342F46] hover:bg-[#1f1b2b]'
          : 'bg-[#EDE8DF] text-[#5A544E] border-[#D2C9B8] hover:bg-[#E2DBD0]'
      }`}
    >
      {children}
    </motion.button>
  );
}

/** A dark terminal-style output panel (always dark for authenticity). */
export function Term({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[#2b2838] bg-[#12101a] text-[#d7d2e6] font-mono text-[11px] leading-relaxed p-3.5 overflow-x-auto ${className}`}
    >
      {children}
    </div>
  );
}

const TERM_TONES: Record<string, string> = {
  dim: 'text-[#6f6a85]',
  in: 'text-[#8fd0ff]',
  ok: 'text-[#7ee0a5]',
  bad: 'text-[#ff9a8f]',
  flag: 'text-amber-300 font-bold',
  plain: 'text-[#d7d2e6]',
};

export type TermTone = 'dim' | 'in' | 'ok' | 'bad' | 'flag' | 'plain';

export function TermLine({ children, tone = 'dim' }: { children: React.ReactNode; tone?: TermTone }) {
  return <div className={`whitespace-pre-wrap break-words ${TERM_TONES[tone]}`}>{children}</div>;
}

export interface LogLine {
  tone: TermTone;
  text: string;
}

/**
 * A running terminal log that animates new lines in (slide + fade) and keeps
 * itself scrolled to the bottom. Used by the SSRF and Pwn labs so every new
 * response reads as it lands instead of snapping in.
 */
export function TermLog({ lines, maxClass = 'max-h-72' }: { lines: LogLine[]; maxClass?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [lines]);

  return (
    <Term className={maxClass.replace('72', '80')}>
      <div ref={ref} className={`${maxClass} overflow-y-auto no-scrollbar`}>
        {lines.map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`whitespace-pre-wrap break-words ${TERM_TONES[l.tone]}`}
          >
            {l.text}
          </motion.div>
        ))}
      </div>
    </Term>
  );
}

/** Vertical stage progress tracker with an animated connecting rail. */
export function StageTracker({
  stages,
  current,
  isDusk,
}: {
  stages: string[];
  current: number; // index of first NOT-yet-done stage
  isDusk: boolean;
}) {
  const total = stages.length;
  // Fraction of the rail that should be filled green (completed stages).
  const fillPct = total > 1 ? Math.min(1, current / (total - 1)) * 100 : 0;

  return (
    <div className="relative">
      {/* rail background */}
      <div
        className={`absolute left-[9px] top-2 bottom-2 w-0.5 rounded-full ${
          isDusk ? 'bg-[#3E3852]' : 'bg-[#D2C9B8]'
        }`}
      />
      {/* animated rail fill */}
      <motion.div
        className="absolute left-[9px] top-2 w-0.5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500"
        initial={false}
        animate={{ height: `calc(${fillPct}% * 0.92)` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
      <ol className="space-y-2 relative">
        {stages.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={i} className="flex items-center gap-2.5 text-xs">
              <motion.span
                initial={false}
                animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={active ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold border z-10 ${
                  done
                    ? isDusk
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                      : 'bg-emerald-200/90 text-emerald-950 border-emerald-300'
                    : active
                    ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 text-white border-transparent'
                    : isDusk
                    ? 'bg-[#2A263A] text-[#6f6a85] border-[#3E3852]'
                    : 'bg-[#EDE8DF] text-[#9a9388] border-[#D2C9B8]'
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={done ? 'done' : 'num'}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {done ? '✓' : i + 1}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
              <span
                className={`font-semibold transition-colors ${
                  active
                    ? isDusk
                      ? 'text-[#F0ECF8]'
                      : 'text-[#2A2623]'
                    : done
                    ? isDusk
                      ? 'text-[#8fc9a6]'
                      : 'text-[#3f7a58]'
                    : isDusk
                    ? 'text-[#9b94ad]'
                    : 'text-[#6A635C]'
                }`}
              >
                {s}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A hint box that crossfades its text when the stage changes. */
export function Hint({ children, isDusk, swapKey }: { children: React.ReactNode; isDusk: boolean; swapKey?: string | number }) {
  return (
    <div
      className={`rounded-2xl p-3 text-xs leading-relaxed border ${
        isDusk ? 'bg-[#161320]/70 border-white/10 text-[#D4CDE4]' : 'bg-[#EFECE6]/90 border-black/5 text-[#443E38]'
      }`}
    >
      <span className="font-bold">💡 Hint: </span>
      {swapKey !== undefined ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={swapKey}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.span>
        </AnimatePresence>
      ) : (
        children
      )}
    </div>
  );
}

/** Celebratory flag banner with a short confetti-dot burst. */
export function WinBanner({ flag, isDusk }: { flag: string; isDusk: boolean }) {
  const dots = ['#f59e0b', '#f43f5e', '#8b5cf6', '#10b981', '#38bdf8', '#fbbf24'];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className={`relative rounded-2xl p-4 border-2 text-center overflow-hidden ${
        isDusk ? 'bg-emerald-950/40 border-emerald-700/60' : 'bg-emerald-100/80 border-emerald-300'
      }`}
    >
      {/* confetti dots */}
      {dots.map((c, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: c }}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{
            opacity: 0,
            x: Math.cos((i / dots.length) * Math.PI * 2) * 70,
            y: Math.sin((i / dots.length) * Math.PI * 2) * 40 - 10,
            scale: 0.4,
          }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      ))}
      <motion.div
        className="text-2xl mb-1"
        initial={{ rotate: -20, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.05 }}
      >
        🎉
      </motion.div>
      <div className={`text-xs font-bold mb-1.5 ${isDusk ? 'text-emerald-200' : 'text-emerald-900'}`}>
        Flag captured
      </div>
      <code
        className={`inline-block text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg break-all ${
          isDusk ? 'bg-[#12101a] text-amber-300' : 'bg-[#2A2623] text-amber-300'
        }`}
      >
        {flag}
      </code>
    </motion.div>
  );
}

/**
 * Compact sound/haptics toggles for a lab. Sound defaults off (quiet for a
 * commute), haptics defaults on; both persist. The haptics toggle hides where
 * the device has no vibration support (e.g. iOS Safari).
 */
export function FeedbackBar({ isDusk }: { isDusk: boolean }) {
  const { sound, haptics, setSound, setHaptics, vibrateSupported } = useFeedback();
  // Device/storage-dependent UI must wait for mount, or SSR and client disagree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Reserve height to avoid a layout shift once the real controls appear.
    return <div className="h-8" aria-hidden />;
  }

  const pill = (on: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors touch-manipulation cursor-pointer min-h-[32px] ${
      on
        ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 text-white border-transparent'
        : isDusk
        ? 'bg-[#2A263A] text-[#B9B2CE] border-[#3E3852] hover:bg-[#353048]'
        : 'bg-[#EDE8DF] text-[#5A544E] border-[#D2C9B8] hover:bg-[#E2DBD0]'
    }`;

  return (
    <div className="flex items-center gap-2 justify-end">
      <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => setSound(!sound)} className={pill(sound)} aria-pressed={sound} aria-label="Toggle sound">
        {sound ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        Sound
      </motion.button>
      {vibrateSupported && (
        <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => setHaptics(!haptics)} className={pill(haptics)} aria-pressed={haptics} aria-label="Toggle haptics">
          <Vibrate className="w-3.5 h-3.5" />
          Haptics
        </motion.button>
      )}
    </div>
  );
}
