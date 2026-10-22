'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, FlaskConical, ChevronRight, CheckCircle2, Eye } from 'lucide-react';
import { useTheme } from '@/lib/ctf/useTheme';
import { WRITEUPS, CATEGORY_ACCENT, type Writeup } from '@/lib/ctf/writeups';
import { useLabProgress, useAllProgress, isDone, type LabProgress } from '@/lib/ctf/progress';

/** Small completion badge for a lab, driven by saved progress. */
function StatusBadge({ p, isDusk }: { p: LabProgress | null; isDusk: boolean }) {
  if (!p || p.status === 'not-started') return null;
  if (p.status === 'solved') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
        <CheckCircle2 className="w-3 h-3" /> Solved
      </span>
    );
  }
  if (p.status === 'watched') {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${isDusk ? 'bg-sky-950/70 text-sky-300 border border-sky-700/60' : 'bg-sky-200/90 text-sky-950 border border-sky-300'}`}>
        <Eye className="w-3 h-3" /> Watched
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${isDusk ? 'bg-amber-950/70 text-amber-300 border border-amber-700/60' : 'bg-amber-200/90 text-amber-950 border border-amber-300'}`}>
      In progress
    </span>
  );
}

function CtfCard({ w, isDusk }: { w: Writeup; isDusk: boolean }) {
  const accent = CATEGORY_ACCENT[w.category];
  const p = useLabProgress(w.slug);
  const pct = p && p.total > 0 ? Math.round((Math.min(p.stage, p.total) / p.total) * 100) : 0;

  return (
    <Link href={`/solved/${w.slug}`} className="block">
      <motion.article
        whileTap={{ scale: 0.99 }}
        className={`relative rounded-3xl p-5 border-2 shadow-sm ${isDusk ? accent.dusk : accent.paper}`}
      >
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${isDusk ? accent.duskSoft : accent.paperSoft}`}>
            {accent.emoji} {accent.label}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wide ${isDusk ? 'text-[#B3ACC5]' : 'text-[#6A635C]'}`}>
            {w.ctf} · {w.difficulty}
          </span>
        </div>

        <h2 className={`text-[17px] font-extrabold leading-snug tracking-tight mb-1 ${isDusk ? 'text-[#F2EFFA]' : 'text-[#2A2623]'}`}>
          {w.title}
        </h2>
        <p className={`text-xs leading-relaxed mb-3 ${isDusk ? 'text-[#D4CDE4]' : 'text-[#443E38]'}`}>
          {w.oneLiner}
        </p>

        {/* Per-lab progress bar + status */}
        {p && p.status !== 'not-started' && (
          <div className="mb-3 flex items-center gap-2.5">
            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDusk ? 'bg-black/30' : 'bg-black/10'}`}>
              <motion.div
                className={`h-full rounded-full ${isDone(p) ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500'}`}
                initial={false}
                animate={{ width: `${isDone(p) ? 100 : pct}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <StatusBadge p={p} isDusk={isDusk} />
          </div>
        )}

        <div className={`flex items-center justify-between pt-3 border-t ${isDusk ? 'border-white/10' : 'border-black/10'}`}>
          <span className={`inline-flex items-center gap-1 text-xs font-bold ${isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'}`}>
            <FlaskConical className="w-3.5 h-3.5" />
            {p && p.status !== 'not-started' ? 'Resume interactive lab' : 'Open interactive lab'}
          </span>
          <ChevronRight className={`w-4 h-4 ${isDusk ? 'text-[#B3ACC5]' : 'text-[#6A635C]'}`} />
        </div>
      </motion.article>
    </Link>
  );
}

export default function SolvedListPage() {
  const { isDusk, toggle } = useTheme();
  const allProgress = useAllProgress();
  const doneCount = WRITEUPS.filter((w) => isDone(allProgress[w.slug])).length;
  const donePct = WRITEUPS.length > 0 ? Math.round((doneCount / WRITEUPS.length) * 100) : 0;

  return (
    <div className={`min-h-screen w-full ${isDusk ? 'bg-[#1E1B29] text-[#EAE6F2]' : 'bg-[#E5DFD3] text-[#2A2623]'}`}>
      <div className={`max-w-md mx-auto min-h-screen flex flex-col pb-28 ${isDusk ? 'bg-[#1E1B29]' : 'bg-[#E5DFD3]'}`}>
        {/* Header */}
        <header className={`px-5 pt-6 pb-4 border-b ${isDusk ? 'border-[#342F46]' : 'border-[#D2C9B8]'}`}>
          <div className="flex items-center justify-between mb-3">
            <Link
              href="/"
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-2xl border transition-all touch-manipulation min-h-[40px] ${
                isDusk
                  ? 'bg-[#2A263A] text-[#E2DCF0] border-[#3E3852] hover:bg-[#353048]'
                  : 'bg-[#EDE8DF] text-[#2A2623] border-[#D2C9B8] hover:bg-[#E2DBD0]'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Feed
            </Link>
            <button
              type="button"
              onClick={toggle}
              className={`px-3 py-2 rounded-2xl text-xs font-bold border transition-all touch-manipulation min-h-[40px] ${
                isDusk
                  ? 'bg-[#2A263A] text-[#EAE6F2] border-[#3E3852] hover:bg-[#353048]'
                  : 'bg-[#EDE8DF] text-[#2A2623] border-[#D2C9B8] hover:bg-[#E2DBD0]'
              }`}
            >
              {isDusk ? '🌆 Dusk' : '☕ Paper'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20 text-lg">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h1 className={`text-2xl font-black tracking-tight leading-tight ${isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'}`}>
                Solved CTF
              </h1>
              <p className={`text-xs font-medium ${isDusk ? 'text-[#B3ACC5]' : 'text-[#5A544E]'}`}>
                Challenges I solved — now learning how, with hands-on labs
              </p>
            </div>
          </div>

          {/* Overall labs-completed progress */}
          <div className={`mt-4 rounded-2xl p-3.5 border space-y-2 ${isDusk ? 'bg-[#2A263A] border-[#3E3852]' : 'bg-[#EDE8DF] border-[#D8D0C0]'}`}>
            <div className="flex items-center justify-between text-xs font-bold">
              <span>
                {doneCount === WRITEUPS.length ? `All ${WRITEUPS.length} labs complete! 🎉` : `${doneCount} of ${WRITEUPS.length} labs done`}
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                doneCount === WRITEUPS.length
                  ? isDusk ? 'bg-emerald-950/70 text-emerald-200 border-emerald-700/60' : 'bg-emerald-200/90 text-emerald-950 border-emerald-300'
                  : isDusk ? 'bg-[#1E1B29] text-[#B3ACC5] border-[#342F46]' : 'bg-[#DCD5C9] text-[#5A544E] border-[#CEC5B4]'
              }`}>
                {donePct}%
              </span>
            </div>
            <div className={`w-full rounded-full h-2 overflow-hidden border ${isDusk ? 'bg-[#1E1B29] border-[#342F46]' : 'bg-[#DCD5C9] border-[#CEC5B4]'}`}>
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500 rounded-full"
                initial={false}
                animate={{ width: `${donePct}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>
        </header>

        {/* Cards */}
        <main className="flex-1 px-4 py-4 space-y-3.5">
          {WRITEUPS.map((w) => (
            <CtfCard key={w.slug} w={w} isDusk={isDusk} />
          ))}

          <p className={`text-[11px] text-center leading-relaxed px-4 pt-2 ${isDusk ? 'text-[#7d7691]' : 'text-[#8a8378]'}`}>
            More write-ups get added here over time. Finish reading these three first. 🙂
          </p>
        </main>
      </div>
    </div>
  );
}
