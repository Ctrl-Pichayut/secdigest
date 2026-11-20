'use client';

import React from 'react';
import { FilterCategory } from '@/lib/types';
import { BookmarkIcon, SearchIcon, SparkleIcon } from '@/components/icons';

export interface EmptyStateProps {
  isDusk: boolean;
  isSearchActive: boolean;
  trimmedQuery: string;
  activeFilter: FilterCategory;
}

export default function EmptyState({
  isDusk,
  isSearchActive,
  trimmedQuery,
  activeFilter,
}: EmptyStateProps) {
  return (
    <div
      data-testid={isSearchActive ? 'search-empty-state' : undefined}
      role={isSearchActive ? 'status' : undefined}
      className={`rounded-3xl border-2 border-dashed p-8 text-center my-8 shadow-xs ${
        isDusk
          ? 'bg-[#2A263A] border-[#3E3852]'
          : 'bg-[#EDE8DF] border-[#D2C9B8]'
      }`}
    >
      <div
        className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 border ${
          isDusk
            ? 'bg-[#352F46] border-[#4A4462] text-amber-300'
            : 'bg-[#E5DFD3] border-[#D2C9B8] text-amber-800'
        }`}
      >
        {isSearchActive ? (
          <SearchIcon className="w-5 h-5" />
        ) : activeFilter === 'SAVED' ? (
          <BookmarkIcon className="w-5 h-5" />
        ) : (
          <SparkleIcon className="w-5 h-5" />
        )}
      </div>
      <h3
        className={`text-sm font-bold mb-1 ${
          isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'
        }`}
      >
        {isSearchActive
          ? `No posts match '${trimmedQuery}'`
          : activeFilter === 'SAVED'
          ? 'No Saved Posts Yet'
          : 'No Posts in This Topic'}
      </h3>
      <p
        className={`text-xs max-w-xs mx-auto leading-relaxed ${
          isDusk ? 'text-[#D5CEE6]' : 'text-[#5A544E]'
        }`}
      >
        {isSearchActive
          ? activeFilter !== 'ALL'
            ? 'Try another keyword, clear the search, or switch back to "All".'
            : 'Try a different keyword or clear the search to browse all posts.'
          : activeFilter === 'SAVED'
          ? 'Tap "Save" on any post to keep it handy for quick offline reference.'
          : 'There are currently no items under this topic tag. Check "All" or refresh for today\'s drop.'}
      </p>
    </div>
  );
}
