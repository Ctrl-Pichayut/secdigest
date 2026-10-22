'use client';

import React from 'react';

/**
 * Small shared primitives for the interactive labs. The "terminal" panels
 * stay dark in both themes so they read as a real console; page chrome
 * (buttons, hints) respects the paper/dusk theme via the isDusk prop.
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
    'px-3.5 py-2 rounded-xl text-xs font-bold transition-all touch-manipulation cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed select-none';
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${tones[tone]} ${full ? 'w-full' : ''}`}
    >
      {children}
    </button>
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
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono transition-all touch-manipulation cursor-pointer active:scale-95 border ${
        active
          ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 text-white border-transparent'
          : isDusk
          ? 'bg-[#161320] text-[#B9B2CE] border-[#342F46] hover:bg-[#1f1b2b]'
          : 'bg-[#EDE8DF] text-[#5A544E] border-[#D2C9B8] hover:bg-[#E2DBD0]'
      }`}
    >
      {children}
    </button>
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

export function TermLine({
  children,
  tone = 'dim',
}: {
  children: React.ReactNode;
  tone?: 'dim' | 'in' | 'ok' | 'bad' | 'flag' | 'plain';
}) {
  const tones: Record<string, string> = {
    dim: 'text-[#6f6a85]',
    in: 'text-[#8fd0ff]',
    ok: 'text-[#7ee0a5]',
    bad: 'text-[#ff9a8f]',
    flag: 'text-amber-300 font-bold',
    plain: 'text-[#d7d2e6]',
  };
  return <div className={`whitespace-pre-wrap break-words ${tones[tone]}`}>{children}</div>;
}

/** Vertical stage progress tracker. */
export function StageTracker({
  stages,
  current,
  isDusk,
}: {
  stages: string[];
  current: number; // index of first NOT-yet-done stage
  isDusk: boolean;
}) {
  return (
    <ol className="space-y-1.5">
      {stages.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={i} className="flex items-center gap-2.5 text-xs">
            <span
              className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold border ${
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
              {done ? '✓' : i + 1}
            </span>
            <span
              className={`font-semibold ${
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
  );
}

export function Hint({ children, isDusk }: { children: React.ReactNode; isDusk: boolean }) {
  return (
    <div
      className={`rounded-2xl p-3 text-xs leading-relaxed border ${
        isDusk
          ? 'bg-[#161320]/70 border-white/10 text-[#D4CDE4]'
          : 'bg-[#EFECE6]/90 border-black/5 text-[#443E38]'
      }`}
    >
      <span className="font-bold">💡 Hint: </span>
      {children}
    </div>
  );
}

export function WinBanner({ flag, isDusk }: { flag: string; isDusk: boolean }) {
  return (
    <div
      className={`rounded-2xl p-4 border-2 text-center ${
        isDusk
          ? 'bg-emerald-950/40 border-emerald-700/60'
          : 'bg-emerald-100/80 border-emerald-300'
      }`}
    >
      <div className="text-2xl mb-1">🎉</div>
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
    </div>
  );
}
