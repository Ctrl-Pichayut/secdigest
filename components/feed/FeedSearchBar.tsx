'use client';

import React from 'react';
import { ALargeSmall, X } from 'lucide-react';
import { SearchIcon } from '@/components/icons';
import { type TextSize } from '@/lib/feed/useTextSize';

const TEXT_SIZE_META: Record<TextSize, { name: string; label: string }> = {
  sm: { name: 'Small', label: 'A' },
  md: { name: 'Medium', label: 'A+' },
  lg: { name: 'Large', label: 'A++' },
};

export interface FeedSearchBarProps {
  isDusk: boolean;
  focusRingClass: string;
  isSearchOpen: boolean;
  searchInput: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchToggleRef: React.RefObject<HTMLButtonElement | null>;
  onToggleSearch: () => void;
  onSearchInputChange: (value: string) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClearAndCollapseSearch: () => void;
  textSize: TextSize;
  onCycleTextSize: () => void;
}

export default function FeedSearchBar({
  isDusk,
  focusRingClass,
  isSearchOpen,
  searchInput,
  searchInputRef,
  searchToggleRef,
  onToggleSearch,
  onSearchInputChange,
  onSearchKeyDown,
  onClearAndCollapseSearch,
  textSize,
  onCycleTextSize,
}: FeedSearchBarProps) {
  const textSizeMeta = TEXT_SIZE_META[textSize] ?? TEXT_SIZE_META.sm;

  return (
    <div className="flex items-center justify-between gap-2">
      <div
        role="search"
        className={`flex items-center rounded-2xl border shadow-xs transition-colors duration-200 ${
          isSearchOpen ? 'w-full' : ''
        } ${
          isDusk
            ? 'bg-[#2A263A] border-[#3E3852] text-[#EAE6F2]'
            : 'bg-[#EDE8DF] border-[#D2C9B8] text-[#2A2623]'
        }`}
      >
        <button
          ref={searchToggleRef}
          type="button"
          data-testid="btn-search-toggle"
          aria-label={isSearchOpen ? 'Close search' : 'Search feed'}
          aria-expanded={isSearchOpen}
          aria-controls={isSearchOpen ? 'feed-search-input' : undefined}
          onClick={onToggleSearch}
          className={`inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-2xl transition-colors touch-manipulation cursor-pointer ${focusRingClass} ${
            isDusk
              ? 'text-[#D8D2E7] hover:text-[#FAF7F2] hover:bg-[#353048]'
              : 'text-[#4A443E] hover:text-[#2A2623] hover:bg-[#E2DBD0]'
          }`}
        >
          <SearchIcon className="w-4 h-4" />
        </button>
        {isSearchOpen && (
          <>
            <label htmlFor="feed-search-input" className="sr-only">
              Search feed
            </label>
            <input
              ref={searchInputRef}
              id="feed-search-input"
              data-testid="feed-search-input"
              type="search"
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search titles, summaries..."
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className={`flex-1 min-w-0 min-h-[40px] bg-transparent px-1.5 text-sm font-medium rounded-xl [&::-webkit-search-cancel-button]:appearance-none ${focusRingClass} ${
                isDusk
                  ? 'text-[#F0ECF8] placeholder:text-[#B3ACC5]'
                  : 'text-[#2A2623] placeholder:text-[#6A635C]'
              }`}
            />
            <button
              type="button"
              data-testid="btn-search-clear"
              aria-label="Clear and close search"
              onClick={onClearAndCollapseSearch}
              className={`inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-2xl transition-colors touch-manipulation cursor-pointer ${focusRingClass} ${
                isDusk
                  ? 'text-[#B3ACC5] hover:text-[#FAF7F2] hover:bg-[#353048]'
                  : 'text-[#5A544E] hover:text-[#2A2623] hover:bg-[#E2DBD0]'
              }`}
            >
              <X aria-hidden="true" className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {!isSearchOpen && (
        <button
          type="button"
          data-testid="btn-text-size"
          aria-label={`Text size: ${textSizeMeta.name}, tap to change`}
          title={`Text size: ${textSizeMeta.name}`}
          onClick={onCycleTextSize}
          className={`inline-flex items-center justify-center gap-1 min-w-[44px] min-h-[44px] px-2.5 rounded-2xl border shadow-xs transition-colors duration-200 touch-manipulation cursor-pointer shrink-0 ${focusRingClass} ${
            isDusk
              ? 'bg-[#2A263A] border-[#3E3852] text-[#D8D2E7] hover:text-[#FAF7F2] hover:bg-[#353048]'
              : 'bg-[#EDE8DF] border-[#D2C9B8] text-[#4A443E] hover:text-[#2A2623] hover:bg-[#E2DBD0]'
          }`}
        >
          <ALargeSmall aria-hidden="true" className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold leading-none">
            {textSizeMeta.label}
          </span>
        </button>
      )}
    </div>
  );
}
