'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Newspaper, FlaskConical, SunMedium, Moon } from 'lucide-react';
import { useTheme } from '@/lib/ctf/useTheme';

/**
 * Thumb-height bottom navigation shown on every page. Keeps the primary
 * destinations (Feed, Solved CTF) and the reading-theme toggle reachable with
 * one hand on a phone. Fixed inside the app's max-w-md column.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const { isDusk, toggle } = useTheme();

  const onFeed = pathname === '/';
  const onSolved = pathname.startsWith('/solved');

  const itemBase =
    'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[10px] font-bold touch-manipulation transition-colors';

  const activeColor = isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]';
  const idleColor = isDusk ? 'text-[#8b84a0]' : 'text-[#8a8378]';

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40"
    >
      <div
        className={`mx-3 mb-3 rounded-2xl border backdrop-blur-md shadow-lg flex items-stretch overflow-hidden ${
          isDusk ? 'bg-[#211d2e]/95 border-[#3E3852]' : 'bg-[#EDE8DF]/95 border-[#D2C9B8]'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Link href="/" className={`${itemBase} ${onFeed ? activeColor : idleColor}`} aria-current={onFeed ? 'page' : undefined}>
          <Newspaper className="w-5 h-5" />
          Feed
          {onFeed && <motion.span layoutId="nav-dot" className="w-1 h-1 rounded-full bg-rose-500" />}
        </Link>

        <Link href="/solved" className={`${itemBase} ${onSolved ? activeColor : idleColor}`} aria-current={onSolved ? 'page' : undefined}>
          <FlaskConical className="w-5 h-5" />
          Solved CTF
          {onSolved && <motion.span layoutId="nav-dot" className="w-1 h-1 rounded-full bg-rose-500" />}
        </Link>

        <button type="button" onClick={toggle} className={`${itemBase} ${idleColor} cursor-pointer`} aria-label="Toggle reading theme">
          {isDusk ? <Moon className="w-5 h-5" /> : <SunMedium className="w-5 h-5" />}
          {isDusk ? 'Dusk' : 'Paper'}
        </button>
      </div>
    </nav>
  );
}
