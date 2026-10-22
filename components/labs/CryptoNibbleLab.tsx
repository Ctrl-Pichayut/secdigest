'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Chip, FeedbackBar, Hint, LabButton, StageTracker, Term, TermLine, WinBanner } from './labUi';
import { useProgressReporter } from '@/lib/ctf/progress';
import { useFeedback } from '@/lib/ctf/feedback';

const STAGES = ['Peel the Base64 layer', 'Decode one byte by hand', 'Recover the whole message'];

/**
 * Interactive StupidEncryption lab. The cipher is implemented for real in
 * the browser (forward + backward), so every token you see is authentic —
 * nothing is hard-coded. Tap any token to watch one byte decode, nibble by
 * nibble, then reveal the whole message.
 */

const FLAG = 'TCTT2026{XLAZYXC0D3RX}';
const MESSAGE = 'The lazy coder stared at the cursor. Flag is TCTT2026{XLAZYXC0D3RX}';

// ---- the cipher, implemented both ways -------------------------------------

function valToLetter(v: number): string {
  return v <= 9 ? String.fromCharCode(65 + v) /* A-J */ : String.fromCharCode(101 + v - 10) /* e-j */;
}
function letterToVal(ch: string): number {
  const c = ch.charCodeAt(0);
  return c >= 65 && c <= 74 ? c - 65 : c - 101 + 10;
}

// plaintext char -> 2-letter cipher token
function encodeChar(ch: string): string {
  const b = ch.charCodeAt(0);
  const hi = b >> 4;
  const lo = b & 0xf;
  const cHi = 10 - hi;
  let cLo: number;
  if (lo === 0) cLo = 0;
  else if (lo <= 9) cLo = 10 - lo;
  else cLo = 25 - lo;
  return valToLetter(cHi) + valToLetter(cLo);
}

interface Decoded {
  token: string;
  cHi: number;
  cLo: number;
  cipherByte: number;
  pHi: number;
  pLo: number;
  plainByte: number;
  char: string;
}

// 2-letter token -> full breakdown
function decodeToken(token: string): Decoded {
  const cHi = letterToVal(token[0]);
  const cLo = letterToVal(token[1]);
  const cipherByte = cHi * 16 + cLo;
  const pHi = 10 - cHi;
  let pLo: number;
  if (cLo === 0) pLo = 0;
  else if (cLo <= 9) pLo = 10 - cLo;
  else pLo = 25 - cLo;
  const plainByte = pHi * 16 + pLo;
  return { token, cHi, cLo, cipherByte, pHi, pLo, plainByte, char: String.fromCharCode(plainByte) };
}

function hex(n: number) {
  return '0x' + n.toString(16).toUpperCase().padStart(2, '0');
}

// ---- UI --------------------------------------------------------------------

function NibbleBox({
  label,
  value,
  accent,
  isDusk,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  isDusk: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[9px] uppercase tracking-wide ${isDusk ? 'text-[#6f6a85]' : 'text-[#9a9388]'}`}>
        {label}
      </span>
      <span
        className={`min-w-[2.2rem] text-center font-mono text-sm font-bold px-2 py-1.5 rounded-lg border ${
          accent
            ? 'bg-gradient-to-tr from-amber-500/90 to-rose-500/90 text-white border-transparent'
            : isDusk
            ? 'bg-[#2A263A] text-[#E2DCF0] border-[#433D58]'
            : 'bg-white text-[#2A2623] border-[#D2C9B8]'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function CryptoNibbleLab({ isDusk, slug = 'crypto-nibble' }: { isDusk: boolean; slug?: string }) {
  const { report, clear } = useProgressReporter(slug);
  const { cue } = useFeedback();
  const tokens = useMemo(() => Array.from(MESSAGE).map(encodeChar), []);
  const tokenStream = useMemo(() => tokens.join(' '), [tokens]);
  const base64 = useMemo(() => {
    try {
      return typeof btoa !== 'undefined' ? btoa(tokenStream) : Buffer.from(tokenStream).toString('base64');
    } catch {
      return '(base64)';
    }
  }, [tokenStream]);

  const [decoded, setDecoded] = useState(false);
  const [selected, setSelected] = useState<number>(0);
  const [touched, setTouched] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [revealCount, setRevealCount] = useState(0); // progressive decode cursor
  const [play, setPlay] = useState('hello');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const det = decodeToken(tokens[selected] ?? 'AA');
  const plaintext = useMemo(() => tokens.map((t) => decodeToken(t).char).join(''), [tokens]);

  // Current stage for the tracker (index of first not-done stage).
  const current = !decoded ? 0 : !touched ? 1 : !revealed ? 2 : 3;

  useEffect(() => {
    if (current > 0 || revealed) {
      report(current, STAGES.length, revealed ? 'solved' : 'in-progress');
    }
  }, [current, revealed, report]);

  // Clean up the reveal interval on unmount.
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  // Decode the full message progressively, character by character.
  const startReveal = () => {
    cue('step');
    setRevealCount(0);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setRevealCount((c) => {
        const next = c + 1;
        if (next >= tokens.length) {
          if (timer.current) clearInterval(timer.current);
          setRevealed(true);
          cue('success');
          return tokens.length;
        }
        return next;
      });
    }, 45);
  };

  const resetLab = () => {
    cue('tap');
    if (timer.current) clearInterval(timer.current);
    setDecoded(false);
    setSelected(0);
    setTouched(false);
    setRevealed(false);
    setRevealCount(0);
    clear();
  };

  const revealedPlain = useMemo(
    () => tokens.slice(0, revealCount).map((t) => decodeToken(t).char).join(''),
    [tokens, revealCount]
  );

  const mutedText = isDusk ? 'text-[#B9B2CE]' : 'text-[#5A544E]';
  const panel = isDusk ? 'bg-[#2A263A] border-[#3E3852]' : 'bg-[#EDE8DF] border-[#D2C9B8]';

  return (
    <div className="space-y-4">
      <StageTracker stages={STAGES} current={current} isDusk={isDusk} />
      <FeedbackBar isDusk={isDusk} />

      {!revealed && (
        <Hint isDusk={isDusk} swapKey={current}>
          {!decoded
            ? 'The file looks like Base64 (letters + a trailing =). Always peel that first — but treat the result as another layer, not the answer.'
            : !touched
            ? 'Tap any token below to watch one byte decode, nibble by nibble. Each two-letter token is one byte.'
            : 'See the rule? Now decode the whole message at once — no key needed, which is exactly the weakness.'}
        </Hint>
      )}

      {/* Layer 1: the file */}
      <div className={`rounded-2xl p-3.5 border space-y-2.5 ${panel}`}>
        <div className={`text-[11px] font-bold uppercase tracking-wider ${mutedText}`}>
          StupidEncryption.txt
        </div>
        <Term>
          <TermLine tone="plain">{base64.slice(0, 160) + (base64.length > 160 ? ' …' : '')}</TermLine>
        </Term>
        {!decoded ? (
          <LabButton
            onClick={() => {
              cue('step');
              setDecoded(true);
            }}
            tone="primary"
            isDusk={isDusk}
            full
          >
            ⬇ Base64-decode
          </LabButton>
        ) : (
          <div className={`text-[11px] ${mutedText}`}>
            Decoded → a stream of two-letter tokens using only 16 symbols (A–J, e–j). 16 = one nibble. Two letters =
            one byte.
          </div>
        )}
      </div>

      {decoded && (
        <>
          {/* Layer 2+3: token grid */}
          <div className={`rounded-2xl p-3.5 border space-y-3 ${panel}`}>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${mutedText}`}>
              Tap a token to decode one byte
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tokens.map((t, i) => {
                const isSel = i === selected;
                const ch = decodeToken(t).char;
                const show = revealed || isSel;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      cue('tap');
                      setSelected(i);
                      setTouched(true);
                    }}
                    className={`font-mono text-[11px] font-bold px-1.5 py-1 rounded-md border transition-all touch-manipulation cursor-pointer active:scale-95 ${
                      isSel
                        ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 text-white border-transparent'
                        : isDusk
                        ? 'bg-[#12101a] text-[#B9B2CE] border-[#342F46] hover:bg-[#1f1b2b]'
                        : 'bg-white text-[#443E38] border-[#D2C9B8] hover:bg-[#F3EFE7]'
                    }`}
                    title={show ? `→ ${ch === ' ' ? 'space' : ch}` : undefined}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* The transform, step by step */}
          <motion.div
            key={selected}
            initial={{ opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`rounded-2xl p-4 border space-y-3 ${isDusk ? 'bg-[#161320]/70 border-white/10' : 'bg-[#EFECE6]/90 border-black/5'}`}
          >
            <div className={`text-[11px] font-bold ${isDusk ? 'text-[#D4CDE4]' : 'text-[#443E38]'}`}>
              Token <span className="font-mono text-rose-400">{det.token}</span> → one character
            </div>

            <div className="flex items-end gap-2 overflow-x-auto no-scrollbar pb-1">
              <NibbleBox label="letter" value={det.token[0]} isDusk={isDusk} />
              <NibbleBox label="letter" value={det.token[1]} isDusk={isDusk} />
              <span className={`pb-3 ${mutedText}`}>→</span>
              <NibbleBox label="hi nib" value={det.cHi} isDusk={isDusk} />
              <NibbleBox label="lo nib" value={det.cLo} isDusk={isDusk} />
              <span className={`pb-3 ${mutedText}`}>=</span>
              <NibbleBox label="cipher" value={hex(det.cipherByte)} isDusk={isDusk} />
            </div>

            <div className={`text-[10px] font-mono pl-1 ${mutedText}`}>
              complement: hi → 10 − {det.cHi} = {det.pHi} &nbsp;•&nbsp; lo →{' '}
              {det.cLo === 0 ? '0 stays 0' : det.cLo <= 9 ? `10 − ${det.cLo} = ${det.pLo}` : `25 − ${det.cLo} = ${det.pLo}`}
            </div>

            <div className="flex items-end gap-2 overflow-x-auto no-scrollbar pb-1">
              <NibbleBox label="hi nib" value={det.pHi} isDusk={isDusk} />
              <NibbleBox label="lo nib" value={det.pLo} isDusk={isDusk} />
              <span className={`pb-3 ${mutedText}`}>=</span>
              <NibbleBox label="plain" value={hex(det.plainByte)} isDusk={isDusk} />
              <span className={`pb-3 ${mutedText}`}>→</span>
              <NibbleBox label="ASCII" value={det.char === ' ' ? '␠' : det.char} accent isDusk={isDusk} />
            </div>
          </motion.div>

          {/* Reveal all — decodes progressively, one character at a time */}
          {!revealed && revealCount === 0 ? (
            <LabButton onClick={startReveal} tone="primary" isDusk={isDusk} full>
              🔓 Decode the whole message
            </LabButton>
          ) : (
            <div className={`rounded-2xl p-3.5 border space-y-2 ${panel}`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center justify-between ${mutedText}`}>
                <span>Recovered plaintext</span>
                {!revealed && (
                  <span className="font-mono normal-case tracking-normal">
                    {revealCount}/{tokens.length}
                  </span>
                )}
              </div>
              <Term>
                <TermLine tone="plain">
                  {revealed ? (
                    plaintext.split(FLAG).map((part, i, arr) => (
                      <React.Fragment key={i}>
                        {part}
                        {i < arr.length - 1 && <span className="text-amber-300 font-bold">{FLAG}</span>}
                      </React.Fragment>
                    ))
                  ) : (
                    <>
                      {revealedPlain}
                      <span className="inline-block w-1.5 h-3 ml-0.5 bg-amber-300 animate-pulse align-middle" />
                    </>
                  )}
                </TermLine>
              </Term>
            </div>
          )}

          {revealed && <WinBanner flag={FLAG} isDusk={isDusk} />}

          {/* Reset */}
          <div className="flex justify-end">
            <LabButton onClick={resetLab} isDusk={isDusk}>
              ↺ Reset lab
            </LabButton>
          </div>

          {/* Why it's broken: the encoder playground */}
          <div className={`rounded-2xl p-3.5 border space-y-2.5 ${isDusk ? 'bg-[#161320]/60 border-[#342F46]' : 'bg-[#EFECE6]/80 border-[#D2C9B8]'}`}>
            <div className={`text-[11px] font-bold ${isDusk ? 'text-[#D4CDE4]' : 'text-[#443E38]'}`}>
              🧪 Why no key = broken: encode your own text
            </div>
            <input
              value={play}
              onChange={(e) => setPlay(e.target.value.slice(0, 40))}
              spellCheck={false}
              className={`w-full rounded-xl px-3 py-2 font-mono text-xs border outline-none ${
                isDusk ? 'bg-[#12101a] text-[#d7d2e6] border-[#342F46]' : 'bg-white text-[#2A2623] border-[#D2C9B8]'
              }`}
            />
            <Term>
              <TermLine tone="in">{Array.from(play).map(encodeChar).join(' ') || '(type something)'}</TermLine>
            </Term>
            <div className={`text-[10px] ${mutedText}`}>
              Same text always makes the same tokens, and you just ran the rule with no secret at all. That is exactly
              why frequency analysis breaks it.
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {['hello', 'the', 'secret', 'AAAA'].map((w) => (
                <Chip key={w} isDusk={isDusk} onClick={() => setPlay(w)}>
                  {w}
                </Chip>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
