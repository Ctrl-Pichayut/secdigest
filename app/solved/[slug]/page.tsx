'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, Flag, Lightbulb } from 'lucide-react';
import { useTheme } from '@/lib/ctf/useTheme';
import { getWriteup, CATEGORY_ACCENT } from '@/lib/ctf/writeups';
import WebSsrfLab from '@/components/labs/WebSsrfLab';
import CryptoNibbleLab from '@/components/labs/CryptoNibbleLab';
import PwnRaceLab from '@/components/labs/PwnRaceLab';

function Collapsible({
  title,
  emoji,
  isDusk,
  defaultOpen = false,
  children,
}: {
  title: string;
  emoji: string;
  isDusk: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl border overflow-hidden ${isDusk ? 'bg-[#2A263A] border-[#3E3852]' : 'bg-[#EDE8DF] border-[#D2C9B8]'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3.5 touch-manipulation cursor-pointer"
      >
        <span className={`text-sm font-bold flex items-center gap-2 ${isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'}`}>
          <span>{emoji}</span>
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isDusk ? 'text-[#B3ACC5]' : 'text-[#6A635C]'}`}
        />
      </button>
      {open && <div className={`px-3.5 pb-4 pt-0 ${isDusk ? 'text-[#D4CDE4]' : 'text-[#443E38]'}`}>{children}</div>}
    </div>
  );
}

export default function WriteupDetailPage() {
  const { isDusk, toggle } = useTheme();
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const w = slug ? getWriteup(slug) : undefined;

  if (!w) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center ${isDusk ? 'bg-[#1E1B29] text-[#EAE6F2]' : 'bg-[#E5DFD3] text-[#2A2623]'}`}>
        <div className="text-center space-y-3 px-6">
          <p className="text-sm font-bold">Write-up not found.</p>
          <Link href="/solved" className="inline-block text-xs font-bold text-rose-500">
            ← Back to Solved CTF
          </Link>
        </div>
      </div>
    );
  }

  const accent = CATEGORY_ACCENT[w.category];
  const mutedText = isDusk ? 'text-[#B3ACC5]' : 'text-[#5A544E]';

  const Lab = w.lab === 'web-ssrf' ? WebSsrfLab : w.lab === 'crypto-nibble' ? CryptoNibbleLab : PwnRaceLab;

  return (
    <div className={`min-h-screen w-full ${isDusk ? 'bg-[#1E1B29] text-[#EAE6F2]' : 'bg-[#E5DFD3] text-[#2A2623]'}`}>
      <div className={`max-w-md mx-auto min-h-screen flex flex-col pb-16 ${isDusk ? 'bg-[#1E1B29]' : 'bg-[#E5DFD3]'}`}>
        {/* Header */}
        <header className={`sticky top-0 z-30 backdrop-blur-md px-5 pt-5 pb-3 border-b ${isDusk ? 'bg-[#1E1B29]/95 border-[#342F46]' : 'bg-[#E5DFD3]/90 border-[#D2C9B8]'}`}>
          <div className="flex items-center justify-between">
            <Link
              href="/solved"
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-2xl border transition-all touch-manipulation ${
                isDusk ? 'bg-[#2A263A] text-[#E2DCF0] border-[#3E3852] hover:bg-[#353048]' : 'bg-[#EDE8DF] text-[#2A2623] border-[#D2C9B8] hover:bg-[#E2DBD0]'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Solved CTF
            </Link>
            <button
              type="button"
              onClick={toggle}
              className={`px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all touch-manipulation ${
                isDusk ? 'bg-[#2A263A] text-[#EAE6F2] border-[#3E3852]' : 'bg-[#EDE8DF] text-[#2A2623] border-[#D2C9B8]'
              }`}
            >
              {isDusk ? '🌆' : '☕'}
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 space-y-4">
          {/* Title block */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${isDusk ? accent.duskSoft : accent.paperSoft}`}>
                {accent.emoji} {accent.label}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${mutedText}`}>
                {w.ctf} · {w.difficulty}
              </span>
            </div>
            <h1 className={`text-2xl font-black tracking-tight leading-tight ${isDusk ? 'text-[#F2EFFA]' : 'text-[#2A2623]'}`}>
              {w.title}
            </h1>
            <p className={`font-mono text-[10px] mt-1 ${mutedText}`}>{w.challenge}</p>
          </div>

          {/* "I actually solved this" note */}
          <div className={`rounded-2xl p-3 text-xs leading-relaxed border ${isDusk ? 'bg-[#161320]/70 border-white/10 text-[#D4CDE4]' : 'bg-[#EFECE6]/90 border-black/5 text-[#443E38]'}`}>
            I solved this in competition, but leaned on AI to get there. This lab is me actually learning how it works.
          </div>

          {/* Big idea */}
          <div className={`rounded-2xl p-4 border ${isDusk ? 'bg-[#28223B] border-[#433963]' : 'bg-[#E6E1F0] border-[#C8BFE0]'}`}>
            <div className={`flex items-center gap-1.5 text-xs font-bold mb-1.5 ${isDusk ? 'text-violet-300' : 'text-[#3D2E5E]'}`}>
              <Lightbulb className="w-3.5 h-3.5" />
              The big idea
            </div>
            <p className={`text-sm font-medium leading-relaxed ${isDusk ? 'text-[#E2DCF0]' : 'text-[#3A3530]'}`}>{w.bigIdea}</p>
          </div>

          {/* TL;DR */}
          <Collapsible title="TL;DR — the whole solve" emoji="📝" isDusk={isDusk} defaultOpen>
            <p className="text-xs leading-relaxed">{w.tldr}</p>
          </Collapsible>

          {/* THE LAB */}
          <div>
            <div className={`flex items-center gap-2 mb-2.5 px-1`}>
              <span className="text-lg">🧪</span>
              <h2 className={`text-sm font-black uppercase tracking-wide ${isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'}`}>
                Interactive lab
              </h2>
            </div>
            <div className={`rounded-3xl p-4 border-2 ${isDusk ? 'bg-[#211d2e] border-[#3E3852]' : 'bg-[#efe9df] border-[#D2C9B8]'}`}>
              <Lab isDusk={isDusk} />
            </div>
          </div>

          {/* Concepts */}
          <Collapsible title="Background concepts" emoji="📚" isDusk={isDusk}>
            <div className="space-y-2.5 pt-1">
              {w.concepts.map((c) => (
                <div key={c.term}>
                  <div className={`text-xs font-bold ${isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'}`}>{c.term}</div>
                  <div className="text-xs leading-relaxed">{c.def}</div>
                </div>
              ))}
            </div>
          </Collapsible>

          {/* Chain */}
          <Collapsible title="The solve, step by step" emoji="🪜" isDusk={isDusk}>
            <ol className="space-y-2.5 pt-1">
              {w.chain.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span
                    className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isDusk ? 'bg-[#433D58] text-[#F0ECF8]' : 'bg-[#DCD5C9] text-[#2A2623]'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div className={`text-xs font-bold ${isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'}`}>{s.title}</div>
                    <div className="text-xs leading-relaxed">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Collapsible>

          {/* Dead ends */}
          <Collapsible title="Dead ends (worth remembering)" emoji="🧱" isDusk={isDusk}>
            <ul className="space-y-2 pt-1 list-disc pl-4">
              {w.deadEnds.map((d, i) => (
                <li key={i} className="text-xs leading-relaxed">
                  {d}
                </li>
              ))}
            </ul>
          </Collapsible>

          {/* Takeaways */}
          <Collapsible title="Takeaways" emoji="🎯" isDusk={isDusk}>
            <ul className="space-y-2 pt-1 list-disc pl-4">
              {w.takeaways.map((t, i) => (
                <li key={i} className="text-xs leading-relaxed">
                  {t}
                </li>
              ))}
            </ul>
          </Collapsible>

          {/* Further reading */}
          <Collapsible title="Study next" emoji="🔭" isDusk={isDusk}>
            <ul className="space-y-1.5 pt-1 list-disc pl-4">
              {w.furtherReading.map((f, i) => (
                <li key={i} className="text-xs leading-relaxed">
                  {f}
                </li>
              ))}
            </ul>
          </Collapsible>

          {/* Flag */}
          <div className={`rounded-2xl p-3.5 border ${isDusk ? 'bg-[#2A263A] border-[#3E3852]' : 'bg-[#EDE8DF] border-[#D2C9B8]'}`}>
            <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1.5 ${mutedText}`}>
              <Flag className="w-3 h-3" />
              The flag
            </div>
            <code className={`block text-[11px] font-mono font-bold break-all px-2.5 py-1.5 rounded-lg ${isDusk ? 'bg-[#12101a] text-amber-300' : 'bg-[#2A2623] text-amber-300'}`}>
              {w.flag}
            </code>
          </div>
        </main>
      </div>
    </div>
  );
}
