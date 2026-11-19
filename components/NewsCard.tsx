'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useDragControls,
  useReducedMotion,
  animate,
} from 'framer-motion';
import { ExternalLink, Bookmark, CheckCircle2 } from 'lucide-react';
import { NewsItem } from '@/lib/types';
import {
  BrainIcon,
  CheckIcon,
  CloudIcon,
  FlameIcon,
  GiftIcon,
  GlobeIcon,
  HourglassIcon,
  LightbulbIcon,
  ShareIcon,
  TrophyIcon,
  type IconComponent,
} from '@/components/icons';

const SWIPE_THRESHOLD_RATIO = 0.35;
const SWIPE_MAX_DRAG_PX = 240;

function hasTextSelectionIn(container: HTMLElement | null): boolean {
  if (typeof window === 'undefined' || typeof window.getSelection !== 'function') {
    return false;
  }
  const selection = window.getSelection();
  if (!selection || selection.toString().trim().length === 0) {
    return false;
  }
  if (!container) return true;
  return (
    (selection.anchorNode !== null && container.contains(selection.anchorNode)) ||
    (selection.focusNode !== null && container.contains(selection.focusNode))
  );
}

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

export function getSourceHost(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\.(?=.*\.)/, '');
    return host || null;
  } catch {
    return null;
  }
}

function formatShortDate(date: Date, now: Date): string {
  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

export function formatRelativeAge(
  createdAt: string | null | undefined,
  now: Date = new Date()
): string | null {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;

  const diffMs = now.getTime() - created.getTime();

  if (diffMs < 60_000) {
    if (diffMs < -5 * 60_000) {
      return formatShortDate(created, now);
    }
    return 'just now';
  }

  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfCreated = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate()
  );
  const calendarDays = Math.round(
    (startOfToday.getTime() - startOfCreated.getTime()) / 86_400_000
  );

  if (calendarDays === 1) {
    return 'yesterday';
  }

  return formatShortDate(created, now);
}

export default function NewsCard({
  item,
  onToggleBookmark,
  onToggleRead,
  theme = 'paper',
}: NewsCardProps) {
  // Independent per-card Thai translation state
  const [isThai, setIsThai] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const shareResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdown = getCtfCountdown(item.event_start_date);
  const sourceHost = getSourceHost(item.url);
  const relativeAge = mounted ? formatRelativeAge(item.created_at) : null;
  const hasThai = Boolean(item.tldr_th);
  const isBreaking = Boolean(item.is_breaking);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (shareResetTimerRef.current !== null) {
        clearTimeout(shareResetTimerRef.current);
      }
    };
  }, []);

  const showShareStatus = (status: 'copied' | 'failed') => {
    setShareStatus(status);
    if (shareResetTimerRef.current !== null) {
      clearTimeout(shareResetTimerRef.current);
    }
    shareResetTimerRef.current = setTimeout(() => {
      setShareStatus('idle');
      shareResetTimerRef.current = null;
    }, 1500);
  };

  const handleShare = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: item.title,
          text: item.tldr,
          url: item.url,
        });
        return;
      } catch (err: unknown) {
        const isAbortError =
          typeof err === 'object' &&
          err !== null &&
          'name' in err &&
          (err as { name?: unknown }).name === 'AbortError';
        if (isAbortError) {
          return;
        }
      }
    }

    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      try {
        await navigator.clipboard.writeText(`${item.title}\n${item.url}`);
        showShareStatus('copied');
        return;
      } catch {
        showShareStatus('failed');
        return;
      }
    }

    showShareStatus('failed');
  };

  const isDusk = theme === 'dusk';

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isCommittingRef = useRef(false);

  const dragControls = useDragControls();
  const shouldReduceMotion = useReducedMotion();
  const x = useMotionValue(0);

  // Background action hints stay invisible at rest (x = 0) and fade in while dragging
  const leftSwipeHintOpacity = useTransform(x, [-110, -24, -4], [1, 0.55, 0]);
  const leftSwipeIconScale = useTransform(x, [-130, -24], [1.05, 0.9]);
  const rightSwipeHintOpacity = useTransform(x, [4, 24, 110], [0, 0.55, 1]);
  const rightSwipeIconScale = useTransform(x, [24, 130], [0.9, 1.05]);

  // Reset swipe state if read status changes while the card remains mounted
  useEffect(() => {
    isCommittingRef.current = false;
    x.set(0);
  }, [item.is_read, x]);

  const snapBack = () => {
    animate(
      x,
      0,
      shouldReduceMotion
        ? { duration: 0 }
        : { type: 'spring', stiffness: 450, damping: 32 }
    );
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (isCommittingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.detail > 1) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [role="button"]')) {
      return;
    }
    if (hasTextSelectionIn(containerRef.current)) {
      return;
    }

    dragControls.start(e);
  };

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = () => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        isDraggingRef.current = false;
      });
    } else {
      isDraggingRef.current = false;
    }

    if (isCommittingRef.current) return;

    if (hasTextSelectionIn(containerRef.current)) {
      snapBack();
      return;
    }

    const cardWidth = containerRef.current?.offsetWidth || 340;
    const threshold = cardWidth * SWIPE_THRESHOLD_RATIO;
    const offsetX = x.get();

    if (offsetX <= -threshold) {
      isCommittingRef.current = true;
      // Toggle only after the slide-out finishes; toggling first re-renders the card
      // (is_read effect resets x to 0) and makes it jump back mid-animation.
      if (shouldReduceMotion) {
        onToggleRead(item.id, item.is_read);
      } else {
        animate(x, -(cardWidth + 24), {
          duration: 0.2,
          ease: 'easeOut',
          onComplete: () => onToggleRead(item.id, item.is_read),
        });
      }
      return;
    }

    if (offsetX >= threshold) {
      onToggleBookmark(item.id, item.is_bookmarked);
      snapBack();
      return;
    }

    snapBack();
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const focusRingClass = isDusk
    ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E1B29]'
    : 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A2623] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E5DFD3]';

  // Category visual metadata per theme (Zero #FFFFFF, Zero #09090b)
  const categoryMeta: {
    label: string;
    Icon: IconComponent | null;
    cardBg: string;
    cardBorder: string;
    badgeClass: string;
    takeawayBox: string;
    takeawayLabel: string;
  } = isDusk
    ? {
        AI_FREE: {
          label: 'Free AI & Credits',
          Icon: GiftIcon,
          cardBg: 'bg-[#1D2E2B]',
          cardBorder: 'border-[#2E4B45]',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
          takeawayBox: 'bg-[#161320]/70 border border-white/10 text-[#E2DCF0]',
          takeawayLabel: 'text-emerald-300',
        },
        CTF_COMPETITION: {
          label: 'CTF Event',
          Icon: TrophyIcon,
          cardBg: 'bg-[#28223B]',
          cardBorder: 'border-[#433963]',
          badgeClass: 'bg-violet-950/80 text-violet-300 border-violet-700/60',
          takeawayBox: 'bg-[#161320]/70 border border-white/10 text-[#E2DCF0]',
          takeawayLabel: 'text-violet-300',
        },
        CVE_SECURITY: {
          label: 'Security Alert',
          Icon: FlameIcon,
          cardBg: 'bg-[#332224]',
          cardBorder: 'border-[#54363A]',
          badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
          takeawayBox: 'bg-[#161320]/70 border border-white/10 text-[#E2DCF0]',
          takeawayLabel: 'text-rose-300',
        },
        DEV_CLOUD: {
          label: 'Dev & Cloud',
          Icon: CloudIcon,
          cardBg: 'bg-[#1E2938]',
          cardBorder: 'border-[#31455E]',
          badgeClass: 'bg-sky-950/80 text-sky-300 border-sky-700/60',
          takeawayBox: 'bg-[#161320]/70 border border-white/10 text-[#E2DCF0]',
          takeawayLabel: 'text-sky-300',
        },
      }[item.category] || {
        label: item.category,
        Icon: null,
        cardBg: 'bg-[#2A263A]',
        cardBorder: 'border-[#3E3852]',
        badgeClass: 'bg-[#37324A] text-[#D8D2E7] border-[#4A4462]',
        takeawayBox: 'bg-[#161320]/70 border border-white/10 text-[#E2DCF0]',
        takeawayLabel: 'text-[#D8D2E7]',
      }
    : {
        AI_FREE: {
          label: 'Free AI & Credits',
          Icon: GiftIcon,
          cardBg: 'bg-[#DFECE6]',
          cardBorder: 'border-[#B8D8CA]',
          badgeClass: 'bg-[#C8E0D5] text-[#1E4D3B] border-[#A8CEBC]',
          takeawayBox: 'bg-[#EFECE6]/90 border border-black/5 text-[#3A3530]',
          takeawayLabel: 'text-[#1E4D3B]',
        },
        CTF_COMPETITION: {
          label: 'CTF Event',
          Icon: TrophyIcon,
          cardBg: 'bg-[#E6E1F0]',
          cardBorder: 'border-[#C8BFE0]',
          badgeClass: 'bg-[#D6CDE7] text-[#3D2E5E] border-[#BDB2D6]',
          takeawayBox: 'bg-[#EFECE6]/90 border border-black/5 text-[#3A3530]',
          takeawayLabel: 'text-[#3D2E5E]',
        },
        CVE_SECURITY: {
          label: 'Security Alert',
          Icon: FlameIcon,
          cardBg: 'bg-[#F2E2DA]',
          cardBorder: 'border-[#E0C2B4]',
          badgeClass: 'bg-[#E8CFC2] text-[#5C2E1B] border-[#D9B7A6]',
          takeawayBox: 'bg-[#EFECE6]/90 border border-black/5 text-[#3A3530]',
          takeawayLabel: 'text-[#5C2E1B]',
        },
        DEV_CLOUD: {
          label: 'Dev & Cloud',
          Icon: CloudIcon,
          cardBg: 'bg-[#DEE9F2]',
          cardBorder: 'border-[#B9D0E4]',
          badgeClass: 'bg-[#C7DCED] text-[#1B4366] border-[#A6C7E0]',
          takeawayBox: 'bg-[#EFECE6]/90 border border-black/5 text-[#3A3530]',
          takeawayLabel: 'text-[#1B4366]',
        },
      }[item.category] || {
        label: item.category,
        Icon: null,
        cardBg: 'bg-[#EDE8DF]',
        cardBorder: 'border-[#D2C9B8]',
        badgeClass: 'bg-[#DCD5C9] text-[#2A2623] border-[#CEC5B4]',
        takeawayBox: 'bg-[#EFECE6]/90 border border-black/5 text-[#3A3530]',
        takeawayLabel: 'text-[#2A2623]',
      };

  const CategoryIcon = categoryMeta.Icon;

  const cardBorderClass = isBreaking
    ? isDusk
      ? 'border-rose-500/75'
      : 'border-rose-500/70'
    : categoryMeta.cardBorder;

  return (
    <div
      ref={containerRef}
      className="relative rounded-3xl overflow-hidden shadow-sm"
    >
      {/* Subtle swipe action hints revealed behind the card while dragging */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-3xl pointer-events-none select-none"
      >
        {/* Left-side hint: revealed when swiping right (Save / Unsave) */}
        <motion.div
          style={{ opacity: rightSwipeHintOpacity }}
          className={`absolute inset-0 rounded-3xl flex items-center justify-start pl-6 border-2 ${
            isDusk
              ? 'bg-amber-950/60 border-amber-800/50 text-amber-200'
              : 'bg-amber-200/80 border-amber-300/90 text-amber-950'
          }`}
        >
          <motion.div
            style={shouldReduceMotion ? undefined : { scale: rightSwipeIconScale }}
            className="flex items-center gap-2 text-xs font-bold tracking-wide"
          >
            <Bookmark
              aria-hidden="true"
              className={`w-4 h-4 shrink-0 ${
                item.is_bookmarked
                  ? isDusk
                    ? 'fill-amber-300 text-amber-300'
                    : 'fill-amber-800 text-amber-800'
                  : ''
              }`}
            />
            <span>{item.is_bookmarked ? 'Unsave' : 'Save'}</span>
          </motion.div>
        </motion.div>

        {/* Right-side hint: revealed when swiping left (Read / Unread) */}
        <motion.div
          style={{ opacity: leftSwipeHintOpacity }}
          className={`absolute inset-0 rounded-3xl flex items-center justify-end pr-6 border-2 ${
            isDusk
              ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-200'
              : 'bg-emerald-200/80 border-emerald-300/90 text-emerald-950'
          }`}
        >
          <motion.div
            style={shouldReduceMotion ? undefined : { scale: leftSwipeIconScale }}
            className="flex items-center gap-2 text-xs font-bold tracking-wide"
          >
            <span>{item.is_read ? 'Unread' : 'Read'}</span>
            <CheckCircle2 aria-hidden="true" className="w-4 h-4 shrink-0" />
          </motion.div>
        </motion.div>
      </div>

      <motion.article
        data-testid={`news-card-${item.id}`}
        drag="x"
        dragDirectionLock
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ left: -SWIPE_MAX_DRAG_PX, right: SWIPE_MAX_DRAG_PX }}
        dragElastic={0.15}
        dragMomentum={false}
        style={{ x }}
        onPointerDown={handlePointerDown}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClickCapture={handleClickCapture}
        className={`relative z-10 rounded-3xl p-5 border-2 transition-colors duration-200 touch-pan-y ${categoryMeta.cardBg} ${cardBorderClass}`}
      >
      {/* Category, Breaking, Countdown & Language Top Bar (No duplicate top Saved badge) */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${categoryMeta.badgeClass}`}
          >
            {CategoryIcon && <CategoryIcon className="w-3.5 h-3.5 shrink-0" />}
            <span>{categoryMeta.label}</span>
          </span>

          {isBreaking && (
            <span
              data-testid={`badge-breaking-${item.id}`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border shadow-2xs ${
                isDusk
                  ? 'bg-rose-600/85 text-[#FAF7F2] border-rose-400/60'
                  : 'bg-rose-700 text-[#FAF7F2] border-rose-800'
              }`}
            >
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-rose-200 shrink-0"
              />
              BREAKING
            </span>
          )}

          {countdown && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                countdown === 'Live Now'
                  ? isDusk
                    ? 'bg-rose-950/70 text-rose-200 border-rose-700/60 animate-pulse shadow-xs'
                    : 'bg-rose-200 text-rose-950 border-rose-300 animate-pulse shadow-xs'
                  : isDusk
                  ? 'bg-amber-950/70 text-amber-200 border-amber-700/60 shadow-xs'
                  : 'bg-amber-200/90 text-amber-950 border-amber-300 shadow-xs'
              }`}
            >
              <HourglassIcon className="w-3 h-3 shrink-0" />
              <span>{countdown}</span>
            </span>
          )}

          {/* Independent Per-Card Thai Translation Toggle Button */}
          {hasThai && (
            <motion.button
              type="button"
              data-testid={`btn-lang-${item.id}`}
              onClick={() => setIsThai((prev) => !prev)}
              whileTap={{ scale: 0.92 }}
              className={`inline-flex items-center justify-center gap-1 min-h-[40px] min-w-[40px] px-3 rounded-full text-xs font-bold border transition-all touch-manipulation cursor-pointer ${focusRingClass} ${
                isThai
                  ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                  : isDusk
                  ? 'bg-[#2A263A] text-[#E2DCF0] hover:text-[#FAF7F2] hover:bg-[#353048] border border-[#433D58]'
                  : 'bg-[#E0DAD0] text-[#4A443E] hover:text-[#2A2623] hover:bg-[#D6CEBF] border border-[#C8BFB0]'
              }`}
              aria-label="Toggle Thai Translation"
              aria-pressed={isThai}
            >
              <GlobeIcon className="w-3 h-3 shrink-0" />
              <span>TH</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Post Title (100% crisp typography, zero dimming) */}
      <h2
        className={`text-[17px] font-extrabold leading-snug tracking-tight ${
          sourceHost || relativeAge ? 'mb-1' : 'mb-2'
        } ${isDusk ? 'text-[#F2EFFA]' : 'text-[#2A2623]'}`}
      >
        {item.title}
      </h2>

      {/* Muted Source Host & Relative Age Meta Line */}
      {(sourceHost || relativeAge) && (
        <div
          data-testid={`meta-line-${item.id}`}
          className={`flex items-center gap-1.5 min-w-0 mb-2.5 text-[11px] sm:text-xs font-medium leading-tight ${
            isDusk ? 'text-[#A9A0C0]' : 'text-[#635C55]'
          }`}
        >
          {sourceHost && (
            <span className="truncate min-w-0" title={sourceHost}>
              {sourceHost}
            </span>
          )}
          {sourceHost && relativeAge && (
            <span aria-hidden="true" className="shrink-0">
              &middot;
            </span>
          )}
          {relativeAge && (
            <time
              dateTime={item.created_at}
              className="shrink-0 whitespace-nowrap"
            >
              {relativeAge}
            </time>
          )}
        </div>
      )}

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
          <LightbulbIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{isThai ? 'สรุปสั้นๆ ว่าทำไมควรรู้' : 'Quick Takeaway'}</span>
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
              <BrainIcon className="w-3.5 h-3.5 shrink-0" />
              <span>ศัพท์เทคนิคในข่าวนี้</span>
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
        className={`flex items-center justify-between gap-1.5 sm:gap-2 pt-3 border-t ${
          isDusk ? 'border-[#433D58]/60' : 'border-[#D2C9B8]'
        }`}
      >
        {/* Bookmark Button (Icon-only) */}
        <motion.button
          type="button"
          data-testid={`btn-bookmark-${item.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(item.id, item.is_bookmarked);
          }}
          whileTap={{ scale: 0.92 }}
          whileHover={{ y: -1 }}
          className={`inline-flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] p-2 rounded-xl text-xs font-semibold transition-all touch-manipulation cursor-pointer ${focusRingClass} ${
            item.is_bookmarked
              ? isDusk
                ? 'bg-amber-950/70 text-amber-200 border border-amber-700/60 font-bold shadow-xs'
                : 'bg-amber-200/90 text-amber-950 border border-amber-300 font-bold shadow-xs'
              : isDusk
              ? 'bg-[#2A263A] text-[#E2DCF0] border border-[#433D58] hover:bg-[#353048] shadow-2xs'
              : 'bg-[#EFECE6] hover:bg-[#E5DFD3] text-[#4A443E] hover:text-[#2A2623] border border-[#D2C9B8] shadow-2xs'
          }`}
          aria-label={
            item.is_bookmarked
              ? `Remove ${item.title} from saved`
              : `Save ${item.title}`
          }
          aria-pressed={item.is_bookmarked}
        >
          <Bookmark
            aria-hidden="true"
            className={`w-4 h-4 shrink-0 ${
              item.is_bookmarked
                ? isDusk
                  ? 'fill-amber-300 text-amber-300'
                  : 'fill-amber-800 text-amber-800'
                : ''
            }`}
          />
        </motion.button>

        {/* Share Button (Icon-only) */}
        <motion.button
          type="button"
          data-testid="share-button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleShare}
          whileTap={{ scale: 0.92 }}
          whileHover={{ y: -1 }}
          className={`inline-flex items-center justify-center shrink-0 gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all touch-manipulation cursor-pointer ${focusRingClass} ${
            shareStatus === 'copied'
              ? isDusk
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 font-bold shadow-xs'
                : 'bg-emerald-200/90 text-emerald-950 border border-emerald-300 font-bold shadow-xs'
              : shareStatus === 'failed'
              ? isDusk
                ? 'bg-rose-950/70 text-rose-200 border border-rose-700/60 font-bold shadow-xs'
                : 'bg-rose-200/90 text-rose-950 border border-rose-300 font-bold shadow-xs'
              : isDusk
              ? 'bg-[#2A263A] text-[#E2DCF0] border border-[#433D58] hover:bg-[#353048] shadow-2xs'
              : 'bg-[#EFECE6] hover:bg-[#E5DFD3] text-[#4A443E] hover:text-[#2A2623] border border-[#D2C9B8] shadow-2xs'
          }`}
          aria-label={`Share ${item.title}`}
        >
          {shareStatus === 'copied' ? (
            <CheckIcon className="w-4 h-4 shrink-0" />
          ) : (
            <ShareIcon className="w-4 h-4 shrink-0" />
          )}
          <span
            aria-live="polite"
            className={shareStatus === 'idle' ? 'sr-only' : undefined}
          >
            {shareStatus === 'copied'
              ? 'Link copied'
              : shareStatus === 'failed'
              ? 'Copy failed'
              : ''}
          </span>
        </motion.button>

        {/* Mark Read Check-in Button */}
        <motion.button
          type="button"
          data-testid={`btn-read-${item.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleRead(item.id, item.is_read);
          }}
          whileTap={{ scale: 0.92 }}
          whileHover={{ y: -1 }}
          className={`inline-flex items-center justify-center shrink-0 gap-1 sm:gap-1.5 min-h-[44px] min-w-[44px] px-2 sm:px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all touch-manipulation cursor-pointer ${focusRingClass} ${
            item.is_read
              ? isDusk
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 font-bold shadow-xs'
                : 'bg-emerald-200/90 text-emerald-950 border border-emerald-300 font-bold shadow-xs'
              : isDusk
              ? 'bg-[#2A263A] text-[#E2DCF0] border border-[#433D58] hover:bg-[#353048] shadow-2xs'
              : 'bg-[#EFECE6] hover:bg-[#E5DFD3] text-[#4A443E] hover:text-[#2A2623] border border-[#D2C9B8] shadow-2xs'
          }`}
          aria-label={item.is_read ? 'Mark as unread' : 'Mark as read'}
          aria-pressed={item.is_read}
        >
          <CheckCircle2
            aria-hidden="true"
            className={`w-3.5 h-3.5 shrink-0 ${
              item.is_read
                ? isDusk
                  ? 'text-emerald-300 fill-emerald-800/40'
                  : 'text-emerald-800 fill-emerald-400/40'
                : ''
            }`}
          />
          <span>{item.is_read ? 'Read' : 'Mark Read'}</span>
        </motion.button>

        {/* Open Source Link */}
        <motion.a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`btn-source-${item.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          whileTap={{ scale: 0.92 }}
          whileHover={{ y: -1 }}
          className={`flex-1 inline-flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] min-w-[44px] px-2 sm:px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all touch-manipulation border shadow-2xs ${focusRingClass} ${
            isDusk
              ? 'bg-[#2A263A] text-[#E2DCF0] border-[#433D58] hover:bg-[#353048]'
              : 'bg-[#EFECE6] hover:bg-[#E5DFD3] text-[#2A2623] border-[#D2C9B8]'
          }`}
          aria-label={`Open ${item.title} in a new tab`}
        >
          <span>Open</span>
          <ExternalLink
            aria-hidden="true"
            className={`w-3.5 h-3.5 shrink-0 ${isDusk ? 'text-[#D4CDE4]' : 'text-[#6A635C]'}`}
          />
        </motion.a>
      </div>
      </motion.article>
    </div>
  );
}
