'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FilterCategory } from '@/lib/types';
import { FILTER_TABS } from '@/lib/feed/constants';

export interface FilterTabsProps {
  activeFilter: FilterCategory;
  onSelectFilter: (category: FilterCategory) => void;
  isDusk: boolean;
  focusRingClass: string;
}

export default function FilterTabs({
  activeFilter,
  onSelectFilter,
  isDusk,
  focusRingClass,
}: FilterTabsProps) {
  return (
    <nav
      aria-label="Category navigation"
      className={`sticky top-0 z-30 backdrop-blur-md border-b px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-2xs transition-colors duration-200 ${
        isDusk
          ? 'bg-[#1E1B29]/95 border-[#342F46]'
          : 'bg-[#E5DFD3]/90 border-[#D2C9B8]'
      }`}
    >
      {FILTER_TABS.map((tab) => {
        const isActive = activeFilter === tab.id;
        const TabIcon = tab.Icon;
        return (
          <motion.button
            key={tab.id}
            type="button"
            data-testid={`filter-${tab.id.toLowerCase()}`}
            aria-pressed={isActive}
            onClick={() => onSelectFilter(tab.id)}
            whileTap={{ scale: 0.94 }}
            className={`shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[40px] min-w-[40px] px-3.5 py-2 rounded-full text-xs font-bold transition-all touch-manipulation cursor-pointer ${focusRingClass} ${
              isActive
                ? isDusk
                  ? 'bg-[#F0ECF8] text-[#1E1B29] shadow-sm border border-[#F0ECF8]'
                  : 'bg-[#2A2623] text-[#FAF7F2] shadow-sm border border-[#2A2623]'
                : isDusk
                ? 'bg-[#2A263A] text-[#D5CEE6] border border-[#3E3852] hover:bg-[#353048] hover:text-[#FAF7F2]'
                : 'bg-[#EDE8DF] text-[#5A544E] border border-[#D2C9B8] hover:bg-[#E2DBD0] hover:text-[#2A2623]'
            }`}
          >
            <TabIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{tab.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
