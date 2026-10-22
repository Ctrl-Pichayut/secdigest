'use client';

import React, { useRef, useState } from 'react';
import { Hint, LabButton, Term, TermLine, WinBanner } from './labUi';

/**
 * Wakeup // Dream Monitor — a TOCTOU race simulator. Two consoles share one
 * session (depth). WAKE checks depth==0 when armed, but the decision is USED
 * later, when the subject name is submitted. Move the shared depth to 1 in
 * that gap and the "kick" misses — you fall into a shell.
 */

const FLAG = 'STDIO2026{2261d535-80f4-4369-a06b-27db4167ca08_[TEAMHASH]}';

type Line = { tone: 'dim' | 'in' | 'ok' | 'bad' | 'flag' | 'plain'; text: string };

export default function PwnRaceLab({ isDusk }: { isDusk: boolean }) {
  const [depth, setDepth] = useState(0);
  const [asleep, setAsleep] = useState(false);
  const [promptOwner, setPromptOwner] = useState<'A' | 'B' | null>(null); // who has an open name prompt
  const [armedDepth, setArmedDepth] = useState<number | null>(null); // depth when WAKE passed (time-of-check)
  const [shell, setShell] = useState(false);
  const [log, setLog] = useState<Line[]>([
    { tone: 'dim', text: 'Two consoles, ONE shared dream. WAKE only works at depth 0.' },
    { tone: 'dim', text: 'Goal: land a shell as user1 and read /home/user1/flag1.' },
  ]);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const push = (lines: Line[]) => {
    setLog((prev) => [...prev, ...lines]);
    requestAnimationFrame(() => logRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }));
  };

  const reset = () => {
    setDepth(0);
    setAsleep(false);
    setPromptOwner(null);
    setArmedDepth(null);
    setShell(false);
    setBusy(false);
    setLog([{ tone: 'dim', text: 'Reset. Two consoles, one shared dream. WAKE only works at depth 0.' }]);
  };

  // --- individual console actions ------------------------------------------
  const doSleep = (who: 'A' | 'B') => {
    setAsleep(true);
    push([{ tone: 'in', text: `[${who}] SLEEP` }, { tone: 'plain', text: `    session sleeping at depth ${depth}` }]);
  };

  const doDive = (who: 'A' | 'B') => {
    setDepth((d) => {
      const nd = Math.min(3, d + 1);
      if (nd === d) push([{ tone: 'in', text: `[${who}] DIVE` }, { tone: 'bad', text: '    The monitor cannot resolve anything deeper.' }]);
      else
        push([
          { tone: 'in', text: `[${who}] DIVE` },
          { tone: 'plain', text: `    shared session depth → ${nd}${promptOwner ? `  (while ${promptOwner}'s name prompt is still open!)` : ''}` },
        ]);
      return nd;
    });
  };

  const doWake = (who: 'A' | 'B') => {
    if (depth === 0) {
      setPromptOwner(who);
      setArmedDepth(0);
      push([
        { tone: 'in', text: `[${who}] WAKE` },
        { tone: 'ok', text: '    depth check PASSES (am I at depth 0? yes)' },
        { tone: 'plain', text: '    Wake sequence armed. Subject name: _' },
      ]);
    } else {
      push([{ tone: 'in', text: `[${who}] WAKE` }, { tone: 'bad', text: '    Wake sequence rejected: unsafe dream activity.' }]);
    }
  };

  const doSubmit = (who: 'A' | 'B') => {
    if (promptOwner !== who) return;
    // time-of-USE: the decision armed earlier is applied against the CURRENT depth
    if (depth >= 1) {
      setShell(true);
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
    setBusy(true);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await wait(350);
    setAsleep(true);
    push([{ tone: 'in', text: '[A] SLEEP' }, { tone: 'plain', text: '    session sleeping at depth 0' }]);
    await wait(900);
    setPromptOwner('B');
    setArmedDepth(0);
    push([
      { tone: 'in', text: '[B] WAKE' },
      { tone: 'ok', text: '    depth check PASSES — prompt opens: "Subject name:"' },
    ]);
    await wait(1100);
    setDepth(1);
    push([{ tone: 'in', text: '[A] DIVE' }, { tone: 'plain', text: '    shared depth → 1  ← the race: moved while B still waits' }]);
    await wait(1100);
    setShell(true);
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

  // one console panel
  const Console = ({ who }: { who: 'A' | 'B' }) => {
    const hasPrompt = promptOwner === who;
    return (
      <div
        className={`flex-1 min-w-0 rounded-2xl p-3 border space-y-2 ${
          isDusk ? 'bg-[#2A263A] border-[#3E3852]' : 'bg-[#EDE8DF] border-[#D2C9B8]'
        }`}
      >
        <div className={`text-[11px] font-bold ${isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'}`}>Console {who}</div>
        <div className="grid grid-cols-2 gap-1.5">
          <LabButton onClick={() => doSleep(who)} disabled={busy} isDusk={isDusk}>
            SLEEP
          </LabButton>
          <LabButton onClick={() => doDive(who)} disabled={busy} isDusk={isDusk}>
            DIVE
          </LabButton>
          <LabButton onClick={() => doWake(who)} disabled={busy} isDusk={isDusk}>
            WAKE
          </LabButton>
          <LabButton
            onClick={() => doSubmit(who)}
            disabled={busy || !hasPrompt}
            tone={hasPrompt ? 'primary' : 'neutral'}
            isDusk={isDusk}
          >
            {hasPrompt ? 'submit name ▸' : 'name…'}
          </LabButton>
        </div>
        {hasPrompt && (
          <div className={`text-[10px] font-mono ${isDusk ? 'text-amber-300' : 'text-[#5C2E1B]'}`}>
            Subject name: _ (prompt open, armed at depth {armedDepth})
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {!shell && (
        <Hint isDusk={isDusk}>
          The naive path (SLEEP → DIVE → DIVE → WAKE) is rejected. Win by splitting the check from the use:{' '}
          <b>A: SLEEP → B: WAKE → A: DIVE → B: submit name</b>. Or hit auto-solve to watch it.
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
          <div className="flex items-center gap-1.5 mt-1">
            {[0, 1, 2, 3].map((d) => (
              <span
                key={d}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono border ${
                  d === depth
                    ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 text-white border-transparent'
                    : isDusk
                    ? 'bg-[#2A263A] text-[#6f6a85] border-[#3E3852]'
                    : 'bg-white text-[#9a9388] border-[#D2C9B8]'
                }`}
              >
                {d}
              </span>
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
        <Console who="A" />
        <Console who="B" />
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
      <Term className="max-h-80">
        <div ref={logRef} className="max-h-72 overflow-y-auto no-scrollbar">
          {log.map((l, i) => (
            <TermLine key={i} tone={l.tone}>
              {l.text}
            </TermLine>
          ))}
        </div>
      </Term>

      {shell && <WinBanner flag={FLAG} isDusk={isDusk} />}

      {/* the race, in one picture */}
      <div className={`rounded-2xl p-3.5 border ${isDusk ? 'bg-[#161320]/60 border-[#342F46]' : 'bg-[#EFECE6]/80 border-[#D2C9B8]'}`}>
        <div className={`text-[11px] font-bold mb-2 ${isDusk ? 'text-[#D4CDE4]' : 'text-[#443E38]'}`}>
          🏁 The race, in one picture
        </div>
        <Term>
          <TermLine tone="dim">time ──▸</TermLine>
          <TermLine tone="plain">A:  SLEEP ──── DIVE ───────────────▸ idle</TermLine>
          <TermLine tone="plain">B:  ──── WAKE ──────── submit "tester" ─▸ shell</TermLine>
          <TermLine tone="dim">         └ check passes      └ depth now 1, kick misses</TermLine>
          <TermLine tone="dim">    depth 0 (check) ───────▸ depth 1 (use)</TermLine>
        </Term>
      </div>
    </div>
  );
}
