'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Bookmark, CheckCircle2 } from 'lucide-react';
import { NewsItem } from '@/lib/types';

interface NewsCardProps {
  item: NewsItem;
  onToggleBookmark: (id: string, currentState: boolean) => void;
  onToggleRead: (id: string, currentState: boolean) => void;
  globalThai?: boolean;
}

export function getCtfCountdown(startDateStr: string | null): string | null {
  if (!startDateStr) return null;
  try {
    const start = new Date(startDateStr);
    const now = new Date();
    const diffMs = start.getTime() - now.getTime();

    if (diffMs <= 0) {
      const hoursPast = Math.abs(diffMs) / (1000 * 60 * 60);
      if (hoursPast < 48) return 'Live Now';
      return null;
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `Starts in ${diffDays}d`;

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) return `Starts in ${diffHours}h`;

    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `Starts in ${Math.max(1, diffMins)}m`;
  } catch {
    return null;
  }
}

export default function NewsCard({ item, onToggleBookmark, onToggleRead, globalThai = false }: NewsCardProps) {
  const [cardLang, setCardLang] = useState<'EN' | 'TH' | null>(null);
  const countdown = getCtfCountdown(item.event_start_date);

  const hasThai = Boolean(item.tldr_th);
  const isThai = hasThai && (cardLang !== null ? cardLang === 'TH' : globalThai);

  const categoryMeta = {
    AI_FREE: {
      label: '🎁 Free AI & Credits',
      cardBg: 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 shadow-xs',
      takeawayBox: 'bg-emerald-100/70 border-emerald-200/90 text-emerald-950',
      takeawayLabel: 'text-emerald-800',
    },
    CTF_COMPETITION: {
      label: '🏆 CTF Event',
      cardBg: 'bg-violet-50/70 border-violet-200 hover:border-violet-300',
      badgeClass: 'bg-violet-100 text-violet-800 border-violet-200 shadow-xs',
      takeawayBox: 'bg-violet-100/70 border-violet-200/90 text-violet-950',
      takeawayLabel: 'text-violet-800',
    },
    CVE_SECURITY: {
      label: '🔥 Security Alert',
      cardBg: 'bg-orange-50/70 border-orange-200 hover:border-orange-300',
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-200 shadow-xs',
      takeawayBox: 'bg-orange-100/70 border-orange-200/90 text-orange-950',
      takeawayLabel: 'text-orange-800',
    },
    DEV_CLOUD: {
      label: '☁️ Dev & Cloud',
      cardBg: 'bg-sky-50/70 border-sky-200 hover:border-sky-300',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-200 shadow-xs',
      takeawayBox: 'bg-sky-100/70 border-sky-200/90 text-sky-950',
      takeawayLabel: 'text-sky-800',
    },
  }[item.category] || {
    label: item.category,
    cardBg: 'bg-stone-50/80 border-stone-200 hover:border-stone-300',
    badgeClass: 'bg-stone-100 text-stone-800 border-stone-200',
    takeawayBox: 'bg-stone-100/70 border-stone-200 text-stone-900',
    takeawayLabel: 'text-stone-700',
  };

  return (
    <article
      data-testid={`news-card-${item.id}`}
      className={`relative rounded-3xl p-5 shadow-sm border-2 transition-all duration-200 ${categoryMeta.cardBg} ${
        item.is_read ? 'opacity-60 saturate-[0.85]' : 'opacity-100'
      }`}
    >
      {/* Category, Status & Language Top Bar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${categoryMeta.badgeClass}`}
          >
            {categoryMeta.label}
          </span>

          {countdown && (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                countdown === 'Live Now'
                  ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse shadow-xs'
                  : 'bg-amber-100 text-amber-800 border-amber-300 shadow-xs'
              }`}
            >
              ⏳ {countdown}
            </span>
          )}

          {/* Per-Card Thai Translation Toggle Button */}
          {hasThai && (
            <motion.button
              type="button"
              data-testid={`btn-lang-${item.id}`}
              onClick={() => setCardLang(isThai ? 'EN' : 'TH')}
              whileTap={{ scale: 0.92 }}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                isThai
                  ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                  : 'bg-white/90 text-stone-700 hover:text-stone-900 border-stone-200/90 shadow-2xs'
              }`}
              aria-label="Toggle language"
            >
              <span>{isThai ? '🇬🇧 EN' : '🇹🇭 TH'}</span>
            </motion.button>
          )}
        </div>

        {item.is_bookmarked && (
          <span className="text-amber-600 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 text-[11px] font-bold">
            <Bookmark className="w-3 h-3 fill-amber-500 text-amber-500" />
            Saved
          </span>
        )}
      </div>

      {/* Post Title */}
      <h2 className="text-[17px] font-extrabold text-slate-900 leading-snug tracking-tight mb-2 hover:text-slate-950">
        {item.title}
      </h2>

      {/* TLDR Summary (Instant swap with animation) */}
      <AnimatePresence mode="wait">
        <motion.p
          key={isThai ? 'th-tldr' : 'en-tldr'}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.18 }}
          className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-3.5 font-normal"
        >
          {isThai && item.tldr_th ? item.tldr_th : item.tldr}
        </motion.p>
      </AnimatePresence>

      {/* Redesigned Takeaway Callout */}
      <div className={`rounded-2xl p-3.5 mb-4 border shadow-xs transition-colors ${categoryMeta.takeawayBox}`}>
        <div className={`flex items-center gap-1.5 text-xs font-bold tracking-tight mb-1.5 ${categoryMeta.takeawayLabel}`}>
          <span>{isThai ? '💡 สรุปสั้นๆ ว่าทำไมควรรู้' : '💡 Quick Takeaway'}</span>
        </div>
        <p className="text-xs sm:text-[13px] font-medium leading-relaxed">
          {isThai && item.actionable_value_th ? item.actionable_value_th : item.actionable_value}
        </p>
      </div>

      {/* Tech Jargon Glossary Box (When in Thai mode) */}
      <AnimatePresence>
        {isThai && item.tech_terms_th && item.tech_terms_th.length > 0 && (
          <motion.div
            data-testid={`tech-terms-${item.id}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl p-3.5 mb-4 bg-white/95 border border-stone-200/90 shadow-2xs overflow-hidden"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
              <span>🧠 ศัพท์เทคนิคในข่าวนี้</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {item.tech_terms_th.map((termObj, idx) => (
                <li key={idx} className="leading-snug">
                  <span className="font-extrabold text-slate-900 bg-stone-100 px-1.5 py-0.5 rounded text-[11px] mr-1.5 border border-stone-200">
                    {termObj.term}
                  </span>
                  <span>{termObj.meaning}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Social Action Bar */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-200/80">
        {/* Bookmark Button */}
        <motion.button
          type="button"
          data-testid={`btn-bookmark-${item.id}`}
          onClick={() => onToggleBookmark(item.id, item.is_bookmarked)}
          whileTap={{ scale: 0.92 }}
          whileHover={{ y: -1 }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation cursor-pointer ${
            item.is_bookmarked
              ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-xs'
              : 'bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border border-stone-200/90 shadow-xs'
          }`}
          aria-label={item.is_bookmarked ? 'Remove bookmark' : 'Bookmark item'}
        >
          <Bookmark className={`w-3.5 h-3.5 ${item.is_bookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
          <span>{item.is_bookmarked ? 'Saved' : 'Save'}</span>
        </motion.button>

        {/* Mark Read Check-in Button */}
        <motion.button
          type="button"
          data-testid={`btn-read-${item.id}`}
          onClick={() => onToggleRead(item.id, item.is_read)}
          whileTap={{ scale: 0.92 }}
          whileHover={{ y: -1 }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation cursor-pointer ${
            item.is_read
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs'
              : 'bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border border-stone-200/90 shadow-xs'
          }`}
          aria-label={item.is_read ? 'Mark as unread' : 'Mark as read'}
        >
          <CheckCircle2 className={`w-3.5 h-3.5 ${item.is_read ? 'text-emerald-600 fill-emerald-200' : ''}`} />
          <span>{item.is_read ? 'Read' : 'Mark Read'}</span>
        </motion.button>

        {/* Read Post Link */}
        <motion.a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`btn-source-${item.id}`}
          whileTap={{ scale: 0.92 }}
          whileHover={{ y: -1 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 hover:bg-white text-slate-700 hover:text-slate-950 border border-stone-200/90 shadow-xs transition-all touch-manipulation"
        >
          <span>Read Post</span>
          <ExternalLink className="w-3 h-3 text-slate-500" />
        </motion.a>
      </div>
    </article>
  );
}
