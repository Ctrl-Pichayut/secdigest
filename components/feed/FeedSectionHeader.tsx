'use client';

import React from 'react';
import { NewsItem } from '@/lib/types';
import { type FeedDayGroup } from '@/lib/feedDates';
import { FlameIcon } from '@/components/icons';

export interface FeedSectionHeaderProps {
  group: FeedDayGroup<NewsItem>;
  isDusk: boolean;
  testIdPrefix: 'unread' | 'read';
}

export default function FeedSectionHeader({
  group,
  isDusk,
  testIdPrefix,
}: FeedSectionHeaderProps) {
  const isBreaking = Boolean(group.isBreaking);
  return (
    <div
      data-testid={`${testIdPrefix}-group-header-${group.key}`}
      className="flex items-center gap-2.5 px-1"
    >
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider shrink-0 ${
          isBreaking
            ? isDusk
              ? 'text-rose-300'
              : 'text-rose-700'
            : isDusk
            ? 'text-[#B3ACC5]'
            : 'text-[#5A544E]'
        }`}
      >
        {isBreaking && <FlameIcon className="w-3 h-3 shrink-0" />}
        <span>{group.label}</span>
      </span>
      <span
        aria-hidden="true"
        className={`h-px flex-1 ${
          isBreaking
            ? isDusk
              ? 'bg-rose-900/70'
              : 'bg-rose-300/80'
            : isDusk
            ? 'bg-[#342F46]'
            : 'bg-[#D2C9B8]'
        }`}
      />
    </div>
  );
}
