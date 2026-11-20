'use client';

import React from 'react';
import { CheckCheck } from 'lucide-react';
import { FilterCategory } from '@/lib/types';

export interface FeedStatusBarProps {
  isDusk: boolean;
  focusRingClass: string;
  isSearchActive: boolean;
  filteredCount: number;
  visibleUnreadCount: number;
  activeFilter: FilterCategory;
  windowDays: number;
  onMarkAllRead: () => void;
}

export default function FeedStatusBar({
  isDusk,
  focusRingClass,
  isSearchActive,
  filteredCount,
  visibleUnreadCount,
  activeFilter,
  windowDays,
  onMarkAllRead,
}: FeedStatusBarProps) {
  return (
    <div
      className={`px-1 text-xs pb-1 ${
        isDusk ? 'text-[#D5CEE6]' : 'text-[#5A544E]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {isSearchActive ? (
          <span
            data-testid="search-results-count"
            aria-live="polite"
            className="font-medium"
          >
            {filteredCount} {filteredCount === 1 ? 'result' : 'results'}
          </span>
        ) : (
          <span className="font-medium">
            Showing {visibleUnreadCount} unread{' '}
            {visibleUnreadCount === 1 ? 'post' : 'posts'}
          </span>
        )}
        {visibleUnreadCount > 0 && (
          <button
            type="button"
            data-testid="btn-mark-all-read"
            onClick={onMarkAllRead}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 -mr-2 text-xs font-semibold transition-colors active:scale-95 touch-manipulation cursor-pointer ${focusRingClass} ${
              isDusk
                ? 'text-rose-400 hover:text-rose-300'
                : 'text-rose-700 hover:text-rose-900'
            }`}
          >
            <CheckCheck aria-hidden="true" className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>
      {isSearchActive && activeFilter !== 'SAVED' && (
        <p
          data-testid="search-window-hint"
          className={`mt-0.5 text-[11px] leading-4 ${
            isDusk ? 'text-[#B3ACC5]' : 'text-[#6A635C]'
          }`}
        >
          Searching items from the last {windowDays} days
        </p>
      )}
    </div>
  );
}
