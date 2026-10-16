'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Bookmark, CheckCircle2 } from 'lucide-react';
import { NewsItem } from '@/lib/types';

interface NewsCardProps {
  item: NewsItem;
  onToggleBookmark: (id: string, currentState: boolean) => void;
  onToggleRead: (id: string, currentState: boolean) => void;
  theme?: 'paper' | 'dusk';
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

export default function NewsCard({
  item,
  onToggleBookmark,
  onToggleRead,
  theme = 'paper',
}: NewsCardProps) {
  // Independent per-card Thai translation state
  const [isThai, setIsThai] = useState(false);
  const countdown = getCtfCountdown(item.event_start_date);
  const hasThai = Boolean(item.tldr_th);

  const isDusk = theme === 'dusk';

  // Category visual metadata per theme (Zero #FFFFFF, Zero #09090b)
  const categoryMeta = isDusk
    ? {
        AI_FREE: {
          label: '🎁 Free AI & Credits',
          cardBg: 'bg-[#1D2E2B] border-[#2E4B45]',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
          takeawayBox: 'bg-[#161320]/70 border border-white/10 text-[#E2DCF0]',
          takeawayLabel: 'text-emerald-300',
        },
        CTF_COMPETITION: {
          label: '🏆 CTF Event',
          cardBg: 'bg-[#28223B] border-[#433963]',
          badgeClass: 'bg-violet-950/80 text-violet-300 border-violet-700/60',
          takeawayBox: 'bg-[#161320]/70 border border-white/10 text-[#E2DCF0]',
          takeawayLabel: 'text-violet-300',
        },
        CVE_SECURITY: {
          label: '🔥 Security Alert',
          cardBg: 'bg-[#332224] border-[#54363A]',
          badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
          takeawayBox: 'bg-[#161320]/70 border border-white/10 text-[#E2DCF0]',
          takeawayLabel: 'text-rose-300',
        },
        DEV_CLOUD: {
          label: '☁️ Dev & Cloud',
          cardBg: 'bg-[#1E2938] border-[#31455E]',
          badgeClass: 'bg-sky-950/80 text-sky-300 border-sky-700/60',
          takeawayBox: 'bg-[#161320]/70 border border-white/10 text-[#E2DCF0]',
          takeawayLabel: 'text-sky-300',
        },
      }[item.category] || {
        label: item.category,
        cardBg: 'bg-[#2A263A] border-[#3E3852]',
        badgeClass: 'bg-[#37324A] text-[#D8D2E7] border-[#4A4462]',
        takeawayBox: 'bg-[#161320]/70 border border-white/10 text-[#E2DCF0]',
        takeawayLabel: 'text-[#D8D2E7]',
      }
    : {
        AI_FREE: {
          label: '🎁 Free AI & Credits',
          cardBg: 'bg-[#DFECE6] border-[#B8D8CA]',
          badgeClass: 'bg-[#C8E0D5] text-[#1E4D3B] border-[#A8CEBC]',
          takeawayBox: 'bg-[#EFECE6]/90 border border-black/5 text-[#3A3530]',
          takeawayLabel: 'text-[#1E4D3B]',
        },
        CTF_COMPETITION: {
          label: '🏆 CTF Event',
          cardBg: 'bg-[#E6E1F0] border-[#C8BFE0]',
          badgeClass: 'bg-[#D6CDE7] text-[#3D2E5E] border-[#BDB2D6]',
          takeawayBox: 'bg-[#EFECE6]/90 border border-black/5 text-[#3A3530]',
          takeawayLabel: 'text-[#3D2E5E]',
        },
        CVE_SECURITY: {
          label: '🔥 Security Alert',
          cardBg: 'bg-[#F2E2DA] border-[#E0C2B4]',
          badgeClass: 'bg-[#E8CFC2] text-[#5C2E1B] border-[#D9B7A6]',
          takeawayBox: 'bg-[#EFECE6]/90 border border-black/5 text-[#3A3530]',
          takeawayLabel: 'text-[#5C2E1B]',
        },
        DEV_CLOUD: {
          label: '☁️ Dev & Cloud',
          cardBg: 'bg-[#DEE9F2] border-[#B9D0E4]',
          badgeClass: 'bg-[#C7DCED] text-[#1B4366] border-[#A6C7E0]',
          takeawayBox: 'bg-[#EFECE6]/90 border border-black/5 text-[#3A3530]',
          takeawayLabel: 'text-[#1B4366]',
        },
      }[item.category] || {
        label: item.category,
        cardBg: 'bg-[#EDE8DF] border-[#D2C9B8]',
        badgeClass: 'bg-[#DCD5C9] text-[#2A2623] border-[#CEC5B4]',
        takeawayBox: 'bg-[#EFECE6]/90 border border-black/5 text-[#3A3530]',
        takeawayLabel: 'text-[#2A2623]',
      };

  return (
    <article
      data-testid={`news-card-${item.id}`}
      className={`relative rounded-3xl p-5 shadow-sm border-2 transition-all duration-200 ${categoryMeta.cardBg}`}
    >
      {/* Category, Countdown & Language Top Bar (No duplicate top Saved badge) */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${categoryMeta.badgeClass}`}
          >
            {categoryMeta.label}
          </span>

          {countdown && (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                countdown === 'Live Now'
                  ? isDusk
                    ? 'bg-rose-950/70 text-rose-200 border-rose-700/60 animate-pulse shadow-xs'
                    : 'bg-rose-200 text-rose-950 border-rose-300 animate-pulse shadow-xs'
                  : isDusk
                  ? 'bg-amber-950/70 text-amber-200 border-amber-700/60 shadow-xs'
                  : 'bg-amber-200/90 text-amber-950 border-amber-300 shadow-xs'
              }`}
            >
              ⏳ {countdown}
            </span>
          )}

          {/* Independent Per-Card Thai Translation Toggle Button */}
          {hasThai && (
            <motion.button
              type="button"
              data-testid={`btn-lang-${item.id}`}
              onClick={() => setIsThai((prev) => !prev)}
              whileTap={{ scale: 0.92 }}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                isThai
                  ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                  : isDusk
                  ? 'bg-[#2A263A] text-[#E2DCF0] hover:text-[#FAF7F2] hover:bg-[#353048] border border-[#433D58]'
                  : 'bg-[#E0DAD0] text-[#4A443E] hover:text-[#2A2623] hover:bg-[#D6CEBF] border border-[#C8BFB0]'
              }`}
              aria-label="Toggle Thai Translation"
            >
              <span>🇹🇭 TH</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Post Title (100% crisp typography, zero dimming) */}
      <h2
        className={`text-[17px] font-extrabold leading-snug tracking-tight mb-2 ${
          isDusk ? 'text-[#F2EFFA]' : 'text-[#2A2623]'
        }`}
      >
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
          className={`text-xs sm:text-sm leading-relaxed mb-3.5 font-normal ${
            isDusk ? 'text-[#D4CDE4]' : 'text-[#443E38]'
          }`}
        >
          {isThai && item.tldr_th ? item.tldr_th : item.tldr}
        </motion.p>
      </AnimatePresence>

      {/* Redesigned Takeaway Callout */}
      <div
        className={`rounded-2xl p-3.5 mb-4 border shadow-xs transition-colors ${categoryMeta.takeawayBox}`}
      >
        <div
          className={`flex items-center gap-1.5 text-xs font-bold tracking-tight mb-1.5 ${categoryMeta.takeawayLabel}`}
        >
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
            className={`rounded-2xl p-3.5 mb-4 border shadow-2xs overflow-hidden ${
              isDusk
                ? 'bg-[#161320]/70 border border-white/10 text-[#E2DCF0]'
                : 'bg-[#EFECE6]/95 border border-[#D2C9B8] text-[#3A3530]'
            }`}
          >
            <div
              className={`flex items-center gap-1.5 text-xs font-bold mb-2 ${
                isDusk ? 'text-[#F2EFFA]' : 'text-[#2A2623]'
              }`}
            >
              <span>🧠 ศัพท์เทคนิคในข่าวนี้</span>
            </div>
            <ul className="space-y-1.5 text-xs">
              {item.tech_terms_th.map((termObj, idx) => (
                <li key={idx} className="leading-snug">
                  <span
                    className={`font-extrabold px-1.5 py-0.5 rounded text-[11px] mr-1.5 border ${
                      isDusk
                        ? 'bg-[#2A263A] text-[#FAF7F2] border border-[#433D58]'
                        : 'bg-[#E0DAD0] text-[#2A2623] border border-[#CEC5B8]'
                    }`}
                  >
                    {termObj.term}
                  </span>
                  <span className={isDusk ? 'text-[#D4CDE4]' : 'text-[#443E38]'}>
                    {termObj.meaning}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Action Bar (Clean non-white pills) */}
      <div
        className={`flex items-center justify-between gap-2 pt-3 border-t ${
          isDusk ? 'border-[#433D58]/60' : 'border-[#D2C9B8]'
        }`}
      >
        {/* Bookmark Button */}
        <motion.button
          type="button"
          data-testid={`btn-bookmark-${item.id}`}
          onClick={() => onToggleBookmark(item.id, item.is_bookmarked)}
          whileTap={{ scale: 0.92 }}
          whileHover={{ y: -1 }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation cursor-pointer ${
            item.is_bookmarked
              ? isDusk
                ? 'bg-amber-950/70 text-amber-200 border border-amber-700/60 font-bold shadow-xs'
                : 'bg-amber-200/90 text-amber-950 border border-amber-300 font-bold shadow-xs'
              : isDusk
              ? 'bg-[#2A263A] text-[#E2DCF0] border border-[#433D58] hover:bg-[#353048] shadow-2xs'
              : 'bg-[#EFECE6] hover:bg-[#E5DFD3] text-[#4A443E] hover:text-[#2A2623] border border-[#D2C9B8] shadow-2xs'
          }`}
          aria-label={item.is_bookmarked ? 'Remove bookmark' : 'Bookmark item'}
        >
          <Bookmark
            className={`w-3.5 h-3.5 ${
              item.is_bookmarked
                ? isDusk
                  ? 'fill-amber-300 text-amber-300'
                  : 'fill-amber-800 text-amber-800'
                : ''
            }`}
          />
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
              ? isDusk
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 font-bold shadow-xs'
                : 'bg-emerald-200/90 text-emerald-950 border border-emerald-300 font-bold shadow-xs'
              : isDusk
              ? 'bg-[#2A263A] text-[#E2DCF0] border border-[#433D58] hover:bg-[#353048] shadow-2xs'
              : 'bg-[#EFECE6] hover:bg-[#E5DFD3] text-[#4A443E] hover:text-[#2A2623] border border-[#D2C9B8] shadow-2xs'
          }`}
          aria-label={item.is_read ? 'Mark as unread' : 'Mark as read'}
        >
          <CheckCircle2
            className={`w-3.5 h-3.5 ${
              item.is_read
                ? isDusk
                  ? 'text-emerald-300 fill-emerald-800/40'
                  : 'text-emerald-800 fill-emerald-400/40'
                : ''
            }`}
          />
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation border shadow-2xs ${
            isDusk
              ? 'bg-[#2A263A] text-[#E2DCF0] border border-[#433D58] hover:bg-[#353048]'
              : 'bg-[#EFECE6] hover:bg-[#E5DFD3] text-[#2A2623] border border-[#D2C9B8]'
          }`}
        >
          <span>Read Post</span>
          <ExternalLink className={`w-3 h-3 ${isDusk ? 'text-[#D4CDE4]' : 'text-[#6A635C]'}`} />
        </motion.a>
      </div>
    </article>
  );
}
