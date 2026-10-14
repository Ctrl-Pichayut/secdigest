'use client';

import React from 'react';
import { ExternalLink, Bookmark, CheckCircle2, ShieldAlert, Cpu, Flag, Cloud, Sparkles } from 'lucide-react';
import { NewsItem } from '@/lib/types';

interface NewsCardProps {
  item: NewsItem;
  onToggleBookmark: (id: string, currentState: boolean) => void;
  onToggleRead: (id: string, currentState: boolean) => void;
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

export default function NewsCard({ item, onToggleBookmark, onToggleRead }: NewsCardProps) {
  const countdown = getCtfCountdown(item.event_start_date);

  const categoryMeta = {
    AI_FREE: {
      label: 'Free AI',
      icon: Cpu,
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    },
    CVE_SECURITY: {
      label: 'KEV Vulnerability',
      icon: ShieldAlert,
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    },
    CTF_COMPETITION: {
      label: 'CTF Event',
      icon: Flag,
      badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    },
    DEV_CLOUD: {
      label: 'Dev & Cloud',
      icon: Cloud,
      badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    },
  }[item.category] || {
    label: item.category,
    icon: ShieldAlert,
    badgeClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  };

  const CategoryIcon = categoryMeta.icon;

  return (
    <article
      data-testid={`news-card-${item.id}`}
      className={`relative rounded-2xl bg-zinc-900/80 border border-zinc-800/80 p-4 transition-all duration-200 shadow-sm ${
        item.is_read ? 'opacity-60 bg-zinc-900/40' : 'opacity-100 hover:border-zinc-700/80'
      }`}
    >
      {/* Category & Status Bar */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${categoryMeta.badgeClass}`}
          >
            <CategoryIcon className="w-3 h-3" />
            {categoryMeta.label}
          </span>

          {countdown && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                countdown === 'Live Now'
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {countdown}
            </span>
          )}
        </div>

        {item.is_bookmarked && (
          <span className="text-amber-400 flex items-center gap-1 text-[11px] font-medium">
            <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            Saved
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="text-base font-bold text-zinc-100 leading-snug mb-2 hover:text-white">
        {item.title}
      </h2>

      {/* TLDR Summary */}
      <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-3">
        {item.tldr}
      </p>

      {/* Highlighted WHY IT MATTERS Callout */}
      <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-3 mb-3.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>Why It Matters</span>
        </div>
        <p className="text-xs text-zinc-300 leading-normal">
          {item.actionable_value}
        </p>
      </div>

      {/* Interactive Action Bar */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/60">
        {/* Bookmark Button */}
        <button
          type="button"
          data-testid={`btn-bookmark-${item.id}`}
          onClick={() => onToggleBookmark(item.id, item.is_bookmarked)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-95 touch-manipulation ${
            item.is_bookmarked
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
          aria-label={item.is_bookmarked ? 'Remove bookmark' : 'Bookmark item'}
        >
          <Bookmark className={`w-3.5 h-3.5 ${item.is_bookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
          <span>{item.is_bookmarked ? 'Saved' : 'Save'}</span>
        </button>

        {/* Mark Read Button */}
        <button
          type="button"
          data-testid={`btn-read-${item.id}`}
          onClick={() => onToggleRead(item.id, item.is_read)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-95 touch-manipulation ${
            item.is_read
              ? 'bg-zinc-800 text-zinc-300 border border-zinc-700/60'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
          aria-label={item.is_read ? 'Mark as unread' : 'Mark as read'}
        >
          <CheckCircle2 className={`w-3.5 h-3.5 ${item.is_read ? 'text-emerald-400 fill-emerald-500/20' : ''}`} />
          <span>{item.is_read ? 'Read' : 'Mark Read'}</span>
        </button>

        {/* Source Link */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`btn-source-${item.id}`}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors active:scale-95 touch-manipulation"
        >
          <span>Source</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </article>
  );
}
