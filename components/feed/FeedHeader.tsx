'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CloudOff, FlaskConical, RefreshCw } from 'lucide-react';
import {
  BoltIcon,
  CheckIcon,
  CoffeeIcon,
  PartyIcon,
  SunsetIcon,
} from '@/components/icons';
import { type FeedFreshness } from '@/lib/feedDates';
import {
  DEFAULT_GREETING_BADGE,
  DEFAULT_SUBTITLE,
} from '@/lib/feed/constants';
import { type ClientTimeInfo } from '@/lib/feed/helpers';

export interface FeedHeaderProps {
  isDusk: boolean;
  focusRingClass: string;
  clientTime: ClientTimeInfo | null;
  freshness: FeedFreshness | null;
  isOffline: boolean;
  pendingSyncCount: number;
  labsDone: number;
  totalLabs: number;
  refreshing: boolean;
  onToggleTheme: () => void;
  onRefresh: () => void;
  isProgressLoading: boolean;
  isAllCaughtUp: boolean;
  totalCount: number;
  totalReadCount: number;
  unreadCount: number;
  percentRead: number;
  error: string | null;
}

export default function FeedHeader({
  isDusk,
  focusRingClass,
  clientTime,
  freshness,
  isOffline,
  pendingSyncCount,
  labsDone,
  totalLabs,
  refreshing,
  onToggleTheme,
  onRefresh,
  isProgressLoading,
  isAllCaughtUp,
  totalCount,
  totalReadCount,
  unreadCount,
  percentRead,
  error,
}: FeedHeaderProps) {
  const GreetingIcon = clientTime ? clientTime.Icon : BoltIcon;

  return (
    <header
      className={`px-5 pt-6 pb-4 border-b transition-colors duration-200 ${
        isDusk ? 'bg-[#1E1B29] border-[#342F46]' : 'bg-[#E5DFD3] border-[#D2C9B8]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <BoltIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                data-testid="time-greeting-badge"
                className={`inline-flex items-center gap-1 min-w-0 max-w-full text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-2xs ${
                  isDusk
                    ? 'bg-[#2A263A] text-[#D8D2E7] border-[#3E3852]'
                    : 'bg-[#EDE8DF] text-[#4A443E] border-[#D2C9B8]'
                }`}
              >
                <GreetingIcon className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {clientTime ? clientTime.badge : DEFAULT_GREETING_BADGE}
                </span>
              </span>
            </div>
            <h1
              className={`truncate text-2xl font-black tracking-tight leading-tight mt-0.5 ${
                isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'
              }`}
            >
              SecDigest
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Solved CTF labs link */}
          <Link
            href="/solved"
            aria-label={`Solved CTF labs${labsDone > 0 ? `, ${labsDone} of ${totalLabs} done` : ''}`}
            className={`relative inline-flex items-center justify-center min-w-[40px] min-h-[40px] p-2.5 rounded-2xl text-xs font-bold border transition-all touch-manipulation cursor-pointer shadow-xs ${focusRingClass} ${
              isDusk
                ? 'bg-[#2A263A] text-[#EAE6F2] border-[#3E3852] hover:bg-[#353048]'
                : 'bg-[#EDE8DF] text-[#2A2623] border-[#D2C9B8] hover:bg-[#E2DBD0]'
            }`}
          >
            <FlaskConical aria-hidden="true" className="w-4 h-4" />
            {labsDone > 0 && (
              <span
                aria-hidden="true"
                style={{ borderColor: isDusk ? '#1E1B29' : '#E5DFD3' }}
                className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center border-2 text-white ${
                  labsDone === totalLabs
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-tr from-amber-500 to-rose-500'
                }`}
              >
                {labsDone === totalLabs ? (
                  <CheckIcon className="w-3 h-3" />
                ) : (
                  labsDone
                )}
              </span>
            )}
          </Link>

          {/* Eye-Comfort Theme Toggle Button (Paper / Dusk) */}
          <motion.button
            type="button"
            data-testid="btn-theme-toggle"
            onClick={onToggleTheme}
            whileTap={{ scale: 0.92 }}
            whileHover={{ y: -1 }}
            className={`inline-flex items-center justify-center min-w-[40px] min-h-[40px] p-2.5 rounded-2xl border transition-all touch-manipulation cursor-pointer shadow-xs ${focusRingClass} ${
              isDusk
                ? 'bg-[#2A263A] text-[#EAE6F2] border-[#3E3852] hover:bg-[#353048]'
                : 'bg-[#EDE8DF] text-[#2A2623] border-[#D2C9B8] hover:bg-[#E2DBD0]'
            }`}
            aria-label="Toggle Reading Theme"
            title={isDusk ? 'Dusk' : 'Paper'}
          >
            {isDusk ? (
              <SunsetIcon className="w-4 h-4" />
            ) : (
              <CoffeeIcon className="w-4 h-4" />
            )}
          </motion.button>

          {/* Refresh Button */}
          <motion.button
            type="button"
            data-testid="btn-refresh"
            onClick={onRefresh}
            disabled={refreshing}
            whileTap={{ scale: 0.92 }}
            whileHover={{ y: -1 }}
            className={`inline-flex items-center justify-center min-w-[40px] min-h-[40px] p-2.5 rounded-2xl border shadow-xs transition-all touch-manipulation cursor-pointer ${focusRingClass} ${
              isDusk
                ? 'text-[#D8D2E7] hover:text-[#FAF7F2] bg-[#2A263A] hover:bg-[#353048] border-[#3E3852]'
                : 'text-[#4A443E] hover:text-[#2A2623] bg-[#EDE8DF] hover:bg-[#E2DBD0] border-[#D2C9B8]'
            }`}
            aria-label="Refresh feed"
          >
            <RefreshCw
              aria-hidden="true"
              className={`w-4 h-4 ${refreshing ? 'animate-spin text-rose-500' : ''}`}
            />
          </motion.button>
        </div>
      </div>

      <div className="mb-3 pl-1 space-y-0.5">
        <p
          className={`text-xs font-medium min-h-4 ${
            isDusk ? 'text-[#B3ACC5]' : 'text-[#5A544E]'
          }`}
        >
          {clientTime
            ? `${clientTime.formattedDate} • ${clientTime.subtitle}`
            : DEFAULT_SUBTITLE}
        </p>
        {(freshness || pendingSyncCount > 0) && (
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] leading-4">
            {freshness && (
              <span
                data-testid="feed-freshness"
                className={`min-w-0 truncate ${
                  freshness.isStale
                    ? isDusk
                      ? 'text-amber-300 font-semibold'
                      : 'text-amber-800 font-semibold'
                    : isDusk
                    ? 'text-[#B3ACC5] font-medium'
                    : 'text-[#6A635C] font-medium'
                }`}
              >
                {freshness.text}
              </span>
            )}
            {freshness && pendingSyncCount > 0 && (
              <span
                aria-hidden="true"
                className={`shrink-0 ${
                  isDusk ? 'text-[#B3ACC5]' : 'text-[#6A635C]'
                }`}
              >
                •
              </span>
            )}
            {pendingSyncCount > 0 && (
              <span
                data-testid="pending-sync-indicator"
                role="status"
                aria-live="polite"
                className={`inline-flex items-center gap-1 min-w-0 overflow-hidden font-medium ${
                  isDusk ? 'text-[#B3ACC5]' : 'text-[#6A635C]'
                }`}
              >
                {isOffline ? (
                  <CloudOff aria-hidden="true" className="w-3 h-3 shrink-0" />
                ) : (
                  <RefreshCw aria-hidden="true" className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate">
                  {pendingSyncCount}{' '}
                  {pendingSyncCount === 1 ? 'change' : 'changes'} waiting to sync
                </span>
              </span>
            )}
          </div>
        )}
        {isOffline && (
          <p
            data-testid="offline-notice"
            className={`truncate text-[11px] leading-4 font-medium ${
              isDusk ? 'text-[#B3ACC5]' : 'text-[#6A635C]'
            }`}
          >
            Offline - showing saved digest
          </p>
        )}
      </div>

      {/* Interactive Daily Progress Bar */}
      <div
        className={`rounded-2xl p-3.5 border shadow-xs space-y-2 ${
          isDusk
            ? 'bg-[#2A263A] border-[#3E3852] text-[#F0ECF8]'
            : 'bg-[#EDE8DF] border-[#D8D0C0] text-[#2A2623]'
        }`}
      >
        {isProgressLoading ? (
          <div
            data-testid="progress-skeleton"
            aria-busy="true"
            aria-label="Loading daily progress"
            className="space-y-2 animate-pulse"
          >
            <div className="flex items-center justify-between min-h-[22px]">
              <div
                className={`h-3.5 w-44 rounded-md ${
                  isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
                }`}
              />
              <div
                className={`h-[22px] w-20 rounded-full ${
                  isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
                }`}
              />
            </div>
            <div
              className={`w-full rounded-full h-2 border ${
                isDusk
                  ? 'bg-[#1E1B29] border-[#342F46]'
                  : 'bg-[#DCD5C9] border-[#CEC5B4]'
              }`}
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between min-h-[22px] text-xs font-bold">
              <span
                data-testid="progress-text"
                className="inline-flex items-center gap-1.5"
              >
                <span>
                  {isAllCaughtUp
                    ? `All ${totalCount} posts caught up today!`
                    : totalCount === 0
                    ? error
                      ? "Unable to load today's progress"
                      : 'No posts in the feed yet'
                    : `${totalReadCount} of ${totalCount} posts caught up today`}
                </span>
                {isAllCaughtUp && <PartyIcon className="w-3.5 h-3.5 shrink-0" />}
              </span>
              <span
                data-testid="unread-counter"
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  unreadCount > 0
                    ? isDusk
                      ? 'bg-rose-950/70 text-rose-200 border-rose-700/60'
                      : 'bg-rose-200/90 text-rose-950 border-rose-300'
                    : isAllCaughtUp
                    ? isDusk
                      ? 'bg-emerald-950/70 text-emerald-200 border-emerald-700/60'
                      : 'bg-emerald-200/90 text-emerald-950 border-emerald-300'
                    : isDusk
                    ? 'bg-[#1E1B29] text-[#B3ACC5] border-[#3E3852]'
                    : 'bg-[#E5DFD3] text-[#5A544E] border-[#D2C9B8]'
                }`}
              >
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : isAllCaughtUp
                  ? 'All caught up'
                  : error
                  ? 'Offline'
                  : '0 posts'}
              </span>
            </div>

            {/* Animated gradient bar */}
            <div
              className={`w-full rounded-full h-2 overflow-hidden border ${
                isDusk
                  ? 'bg-[#1E1B29] border-[#342F46]'
                  : 'bg-[#DCD5C9] border-[#CEC5B4]'
              }`}
            >
              <motion.div
                data-testid="progress-bar-fill"
                className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500 rounded-full"
                initial={false}
                animate={{ width: `${percentRead}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
