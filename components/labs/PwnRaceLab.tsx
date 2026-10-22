'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FeedbackBar, Hint, LabButton, StageTracker, TermLog, WinBanner, type LogLine } from './labUi';
import { useProgressReporter, type LabStatus } from '@/lib/ctf/progress';
import { useFeedback } from '@/lib/ctf/feedback';

/**
 * Wakeup // Dream Monitor — a TOCTOU race simulator. Two consoles share one
 * session (depth). WAKE checks depth==0 when armed, but the decision is USED
 * later, when the subject name is submitted. Move the shared depth to 1 in
 * that gap and the "kick" misses — you fall into a shell.
 */

const FLAG = 'STDIO2026{2261d535-80f4-4369-a06b-27db4167ca08_[TEAMHASH]}';

const STAGES = ['Arm WAKE at depth 0', 'Win the race: depth → 1 while armed', 'Submit the name → shell + flag'];

// One console panel, lifted OUT of the parent render so it is not recreated on
// every state change (which would also kill its tap animations).
function Console({
  who,
  isDusk,
  busy,
  hasPrompt,
  armedDepth,
  onSleep,
  onDive,
  onWake,
  onSubmit,
}: {
  who: 'A' | 'B';
  isDusk: boolean;
  busy: boolean;
  hasPrompt: boolean;
  armedDepth: number | null;
  onSleep: () => void;
  onDive: () => void;
  onWake: () => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      animate={hasPrompt ? { boxShadow: ['0 0 0 0 rgba(245,158,11,0)', '0 0 0 3px rgba(245,158,11,0.35)', '0 0 0 0 rgba(245,158,11,0)'] } : { boxShadow: '0 0 0 0 rgba(245,158,11,0)' }}
      transition={hasPrompt ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      className={`flex-1 min-w-0 rounded-2xl p-3 border space-y-2 ${
        isDusk ? 'bg-[#2A263A] border-[#3E3852]' : 'bg-[#EDE8DF] border-[#D2C9B8]'
      }`}
    >
      <div className={`text-[11px] font-bold ${isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'}`}>Console {who}</div>
      <div className="grid grid-cols-2 gap-1.5">
        <LabButton onClick={onSleep} disabled={busy} isDusk={isDusk}>
          SLEEP
        </LabButton>
        <LabButton onClick={onDive} disabled={busy} isDusk={isDusk}>
          DIVE
        </LabButton>
        <LabButton onClick={onWake} disabled={busy} isDusk={isDusk}>
          WAKE
        </LabButton>
        <LabButton onClick={onSubmit} disabled={busy || !hasPrompt} tone={hasPrompt ? 'primary' : 'neutral'} isDusk={isDusk}>
          {hasPrompt ? 'submit name ▸' : 'name…'}
        </LabButton>
      </div>
      {hasPrompt && (
        <div className={`text-[10px] font-mono ${isDusk ? 'text-amber-300' : 'text-[#5C2E1B]'}`}>
          Subject name: _ (prompt open, armed at depth {armedDepth})
        </div>
      )}
    </motion.div>
  );
}

export default function PwnRaceLab({ isDusk, slug = 'pwn-race' }: { isDusk: boolean; slug?: string }) {
  const { report, clear } = useProgressReporter(slug);
  const { cue } = useFeedback();
  const [depth, setDepth] = useState(0);
  const [promptOwner, setPromptOwner] = useState<'A' | 'B' | null>(null); // who has an open name prompt
  const [armedDepth, setArmedDepth] = useState<number | null>(null); // depth when WAKE passed (time-of-check)
  const [shell, setShell] = useState(false);
  const [solvedBy, setSolvedBy] = useState<'self' | 'auto' | null>(null);
  const [log, setLog] = useState<LogLine[]>([
    { tone: 'dim', text: 'Two consoles, ONE shared dream. WAKE only works at depth 0.' },
    { tone: 'dim', text: 'Goal: land a shell as user1 and read /home/user1/flag1.' },
  ]);
  const [busy, setBusy] = useState(false);

  // Track pending auto-solve timeouts so we can cancel on reset / unmount.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelled = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => () => {
    cancelled.current = true;
    clearTimers();
  }, []);

  // Stage for the tracker.
  const current = shell ? 3 : promptOwner && depth >= 1 ? 2 : promptOwner ? 1 : 0;

  useEffect(() => {
    if (shell) {
      report(3, STAGES.length, (solvedBy === 'self' ? 'solved' : 'watched') as LabStatus);
    } else if (current > 0) {
      report(current, STAGES.length, 'in-progress');
    }
  }, [shell, solvedBy, current, report]);

  const push = (lines: LogLine[]) => setLog((prev) => [...prev, ...lines]);

  const reset = () => {
    cancelled.current = true;
    clearTimers();
    cue('tap');
    setDepth(0);
    setPromptOwner(null);
    setArmedDepth(null);
    setShell(false);
    setSolvedBy(null);
    setBusy(false);
    clear();
    setLog([{ tone: 'dim', text: 'Reset. Two consoles, one shared dream. WAKE only works at depth 0.' }]);
  };

  // --- individual console actions ------------------------------------------
  const doSleep = (who: 'A' | 'B') => {
    cue('tap');
    push([{ tone: 'in', text: `[${who}] SLEEP` }, { tone: 'plain', text: `    session sleeping at depth ${depth}` }]);
  };

  const doDive = (who: 'A' | 'B') => {
    setDepth((d) => {
      const nd = Math.min(3, d + 1);
      if (nd === d) {
        cue('error');
        push([{ tone: 'in', text: `[${who}] DIVE` }, { tone: 'bad', text: '    The monitor cannot resolve anything deeper.' }]);
      } else {
        cue('step');
        push([
          { tone: 'in', text: `[${who}] DIVE` },
          { tone: 'plain', text: `    shared session depth → ${nd}${promptOwner ? `  (while ${promptOwner}'s name prompt is still open!)` : ''}` },
        ]);
      }
      return nd;
    });
  };

  const doWake = (who: 'A' | 'B') => {
    if (depth === 0) {
      cue('step');
      setPromptOwner(who);
      setArmedDepth(0);
      push([
        { tone: 'in', text: `[${who}] WAKE` },
        { tone: 'ok', text: '    depth check PASSES (am I at depth 0? yes)' },
        { tone: 'plain', text: '    Wake sequence armed. Subject name: _' },
      ]);
    } else {
      cue('error');
      push([{ tone: 'in', text: `[${who}] WAKE` }, { tone: 'bad', text: '    Wake sequence rejected: unsafe dream activity.' }]);
    }
  };

  const doSubmit = (who: 'A' | 'B') => {
    if (promptOwner !== who) return;
    // time-of-USE: the decision armed earlier is applied against the CURRENT depth
    if (depth >= 1) {
      cue('success');
      setShell(true);
      setSolvedBy('self');
      setPromptOwner(null);
      push([
        { tone: 'in', text: `[${who}] submit name "tester"` },
        { tone: 'ok', text: '    The kick misses. You fall into a deeper constructed dream.' },
        { tone: 'plain', text: '    sh: can\'t access tty; job control turned off' },
        { tone: 'plain', text: '    ~ $ id' },
        { tone: 'plain', text: '    uid=1001(user1) gid=1001(user1)' },
        { tone: 'in', text: '    ~ $ cat /home/user1/flag1' },
        { tone: 'flag', text: '    ' + FLAG },
      ]);
    } else {
      cue('error');
      setPromptOwner(null);
      setArmedDepth(null);
      push([
        { tone: 'in', text: `[${who}] submit name "tester"` },
        { tone: 'bad', text: '    tester is awake.  (no shell — check & use agreed at depth 0)' },
        { tone: 'dim', text: '    The race window is BETWEEN arming WAKE and submitting the name.' },
      ]);
    }
  };

  // --- auto-solve: animate the winning race --------------------------------
  const autoSolve = async () => {
    reset();
    cancelled.current = false;
    setBusy(true);
    const wait = (ms: number) =>
      new Promise<void>((r) => {
        const id = setTimeout(r, ms);
        timers.current.push(id);
      });

    await wait(400);
    if (cancelled.current) return;
    push([{ tone: 'in', text: '[A] SLEEP' }, { tone: 'plain', text: '    session sleeping at depth 0' }]);

    await wait(900);
    if (cancelled.current) return;
    cue('step');
    setPromptOwner('B');
    setArmedDepth(0);
    push([
      { tone: 'in', text: '[B] WAKE' },
      { tone: 'ok', text: '    depth check PASSES — prompt opens: "Subject name:"' },
    ]);

    await wait(1100);
    if (cancelled.current) return;
    cue('step');
    setDepth(1);
    push([{ tone: 'in', text: '[A] DIVE' }, { tone: 'plain', text: '    shared depth → 1  ← the race: moved while B still waits' }]);

    await wait(1100);
    if (cancelled.current) return;
    cue('success');
    setShell(true);
    setSolvedBy('auto');
    setPromptOwner(null);
    push([
      { tone: 'in', text: '[B] submit name "tester"' },
      { tone: 'ok', text: '    kick misses → BusyBox shell as user1' },
      { tone: 'in', text: '    ~ $ cat /home/user1/flag1' },
      { tone: 'flag', text: '    ' + FLAG },
    ]);
    setBusy(false);
  };

  const mutedText = isDusk ? 'text-[#B9B2CE]' : 'text-[#5A544E]';

  return (
    <div className="space-y-4">
      <StageTracker stages={STAGES} current={current} isDusk={isDusk} />
      <FeedbackBar isDusk={isDusk} />

      {!shell && (
        <Hint isDusk={isDusk} swapKey={current}>
          {current === 0 ? (
            <>
              The naive path (SLEEP → DIVE → DIVE → WAKE) is rejected. Win by splitting the check from the use:{' '}
              <b>A: SLEEP → B: WAKE → A: DIVE → B: submit name</b>. Or hit auto-solve to watch it.
            </>
          ) : current === 1 ? (
            <>
              WAKE is armed at depth 0. Now, before you submit the name, use the <b>other</b> console to DIVE — move the
              shared depth to 1.
            </>
          ) : (
            <>Depth is 1 while the prompt is still armed from depth 0. Submit the name now — the kick will miss.</>
          )}
        </Hint>
      )}

      {/* shared state meter */}
      <div
        className={`rounded-2xl p-3.5 border flex items-center justify-between ${
          isDusk ? 'bg-[#161320]/70 border-[#342F46]' : 'bg-[#EFECE6]/90 border-[#D2C9B8]'
        }`}
      >
        <div>
          <div className={`text-[10px] uppercase tracking-wider ${mutedText}`}>shared session depth</div>
          <div className="relative flex items-center gap-1.5 mt-1">
            {[0, 1, 2, 3].map((d) => (
              <div
                key={d}
                className={`relative w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono border ${
                  isDusk ? 'bg-[#2A263A] text-[#6f6a85] border-[#3E3852]' : 'bg-white text-[#9a9388] border-[#D2C9B8]'
                }`}
              >
                {d}
                {d === depth && (
                  <motion.div
                    layoutId="depth-marker"
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    className="absolute inset-0 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 flex items-center justify-center text-white"
                  >
                    {d}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[10px] uppercase tracking-wider ${mutedText}`}>wake check</div>
          <div
            className={`text-xs font-bold mt-1 ${
              depth === 0 ? (isDusk ? 'text-emerald-300' : 'text-emerald-700') : isDusk ? 'text-rose-300' : 'text-rose-700'
            }`}
          >
            {depth === 0 ? 'allowed' : 'rejected'}
          </div>
        </div>
      </div>

      {/* two consoles */}
      <div className="flex gap-2.5">
        <Console
          who="A"
          isDusk={isDusk}
          busy={busy}
          hasPrompt={promptOwner === 'A'}
          armedDepth={armedDepth}
          onSleep={() => doSleep('A')}
          onDive={() => doDive('A')}
          onWake={() => doWake('A')}
          onSubmit={() => doSubmit('A')}
        />
        <Console
          who="B"
          isDusk={isDusk}
          busy={busy}
          hasPrompt={promptOwner === 'B'}
          armedDepth={armedDepth}
          onSleep={() => doSleep('B')}
          onDive={() => doDive('B')}
          onWake={() => doWake('B')}
          onSubmit={() => doSubmit('B')}
        />
      </div>

      <div className="flex items-center gap-2">
        <LabButton onClick={autoSolve} disabled={busy} tone="primary" isDusk={isDusk}>
          ▶ Auto-solve (watch the race)
        </LabButton>
        <LabButton onClick={reset} disabled={busy} isDusk={isDusk}>
          ↺ Reset
        </LabButton>
      </div>

      {/* log */}
      <TermLog lines={log} />

      {shell && <WinBanner flag={FLAG} isDusk={isDusk} />}

      {/* the race, in one picture */}
      <div className={`rounded-2xl p-3.5 border ${isDusk ? 'bg-[#161320]/60 border-[#342F46]' : 'bg-[#EFECE6]/80 border-[#D2C9B8]'}`}>
        <div className={`text-[11px] font-bold mb-2 ${isDusk ? 'text-[#D4CDE4]' : 'text-[#443E38]'}`}>
          🏁 The race, in one picture
        </div>
        <div className="rounded-2xl border border-[#2b2838] bg-[#12101a] text-[#d7d2e6] font-mono text-[11px] leading-relaxed p-3.5 overflow-x-auto space-y-0.5">
          <div className="text-[#6f6a85]">time ──▸</div>
          <div className="text-[#d7d2e6]">A:  SLEEP ──── DIVE ───────────────▸ idle</div>
          <div className="text-[#d7d2e6]">B:  ──── WAKE ──────── submit &quot;tester&quot; ─▸ shell</div>
          <div className="text-[#6f6a85]">         └ check passes      └ depth now 1, kick misses</div>
          <div className="text-[#6f6a85]">    depth 0 (check) ───────▸ depth 1 (use)</div>
        </div>
      </div>
    </div>
  );
}
