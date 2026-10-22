'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FlaskConical, ChevronRight } from 'lucide-react';
import { useTheme } from '@/lib/ctf/useTheme';
import { WRITEUPS, CATEGORY_ACCENT } from '@/lib/ctf/writeups';

export default function SolvedListPage() {
  const { isDusk, toggle } = useTheme();

  return (
    <div className={`min-h-screen w-full ${isDusk ? 'bg-[#1E1B29] text-[#EAE6F2]' : 'bg-[#E5DFD3] text-[#2A2623]'}`}>
      <div className={`max-w-md mx-auto min-h-screen flex flex-col pb-16 ${isDusk ? 'bg-[#1E1B29]' : 'bg-[#E5DFD3]'}`}>
        {/* Header */}
        <header className={`px-5 pt-6 pb-4 border-b ${isDusk ? 'border-[#342F46]' : 'border-[#D2C9B8]'}`}>
          <div className="flex items-center justify-between mb-3">
            <Link
              href="/"
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-2xl border transition-all touch-manipulation ${
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
              className={`px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all touch-manipulation ${
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
        </header>

        {/* Cards */}
        <main className="flex-1 px-4 py-4 space-y-3.5">
          {WRITEUPS.map((w) => {
            const accent = CATEGORY_ACCENT[w.category];
            return (
              <Link key={w.slug} href={`/solved/${w.slug}`} className="block">
                <article
                  className={`relative rounded-3xl p-5 border-2 shadow-sm transition-all active:scale-[0.99] ${
                    isDusk ? accent.dusk : accent.paper
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                        isDusk ? accent.duskSoft : accent.paperSoft
                      }`}
                    >
                      {accent.emoji} {accent.label}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isDusk ? 'text-[#B3ACC5]' : 'text-[#6A635C]'}`}>
                      {w.ctf} · {w.difficulty}
                    </span>
                  </div>

                  <h2 className={`text-[17px] font-extrabold leading-snug tracking-tight mb-1 ${isDusk ? 'text-[#F2EFFA]' : 'text-[#2A2623]'}`}>
                    {w.title}
                  </h2>
                  <p className={`text-xs leading-relaxed mb-3.5 ${isDusk ? 'text-[#D4CDE4]' : 'text-[#443E38]'}`}>
                    {w.oneLiner}
                  </p>

                  <div className={`flex items-center justify-between pt-3 border-t ${isDusk ? 'border-white/10' : 'border-black/10'}`}>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'}`}>
                      <FlaskConical className="w-3.5 h-3.5" />
                      Open interactive lab
                    </span>
                    <ChevronRight className={`w-4 h-4 ${isDusk ? 'text-[#B3ACC5]' : 'text-[#6A635C]'}`} />
                  </div>
                </article>
              </Link>
            );
          })}

          <p className={`text-[11px] text-center leading-relaxed px-4 pt-2 ${isDusk ? 'text-[#7d7691]' : 'text-[#8a8378]'}`}>
            More write-ups get added here over time. Finish reading these three first. 🙂
          </p>
        </main>
      </div>
    </div>
  );
}
