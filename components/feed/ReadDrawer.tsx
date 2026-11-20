'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { NewsItem } from '@/lib/types';
import { type FeedDayGroup } from '@/lib/feedDates';
import { type FeedTheme } from '@/lib/feed/constants';
import { type TextSize } from '@/lib/feed/useTextSize';
import { CheckIcon } from '@/components/icons';
import NewsCard from '@/components/NewsCard';
import FeedSectionHeader from '@/components/feed/FeedSectionHeader';

export interface ReadDrawerProps {
  readCount: number;
  readGroups: FeedDayGroup<NewsItem>[];
  isOpen: boolean;
  onToggleOpen: () => void;
  isDusk: boolean;
  theme: FeedTheme;
  textSize?: TextSize;
  focusRingClass: string;
  onToggleBookmark: (id: string, currentState: boolean) => void;
  onToggleRead: (id: string, currentState: boolean) => void;
}

export default function ReadDrawer({
  readCount,
  readGroups,
  isOpen,
  onToggleOpen,
  isDusk,
  theme,
  textSize = 'sm',
  focusRingClass,
  onToggleBookmark,
  onToggleRead,
}: ReadDrawerProps) {
  return (
    <div className="pt-2">
      <motion.button
        type="button"
        data-testid="read-items-divider"
        aria-expanded={isOpen}
        aria-controls="read-items-drawer"
        onClick={onToggleOpen}
        whileTap={{ scale: 0.98 }}
        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all font-bold text-xs touch-manipulation cursor-pointer shadow-xs ${focusRingClass} ${
          isDusk
            ? 'bg-[#2A263A] hover:bg-[#353048] border-[#3E3852] text-[#F0ECF8]'
            : 'bg-[#EDE8DF] hover:bg-[#E2DBD0] border-[#D2C9B8] text-[#2A2623]'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`w-5 h-5 rounded-full flex items-center justify-center ${
              isDusk
                ? 'bg-emerald-950/70 text-emerald-300'
                : 'bg-emerald-200/90 text-emerald-950'
            }`}
          >
            <CheckIcon className="w-3 h-3" />
          </span>
          <span>Caught Up Posts ({readCount})</span>
        </div>
        <span
          className={`text-[11px] font-semibold flex items-center gap-1 ${
            isDusk ? 'text-[#D5CEE6]' : 'text-[#6A635C]'
          }`}
        >
          {isOpen ? 'Hide' : 'Tap to expand'}
          <ChevronDown
            aria-hidden="true"
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </motion.button>

      {/* Collapsible Drawer Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="read-drawer-content"
            id="read-items-drawer"
            data-testid="read-items-drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="space-y-3.5 pt-3 overflow-hidden"
          >
            <AnimatePresence mode="popLayout">
              {readGroups.flatMap((group, groupIdx) => [
                <motion.div
                  key={`read-header-${group.key}`}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={groupIdx > 0 ? 'pt-2.5' : undefined}
                >
                  <FeedSectionHeader
                    group={group}
                    isDusk={isDusk}
                    testIdPrefix="read"
                  />
                </motion.div>,
                ...group.items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                  >
                    <NewsCard
                      item={item}
                      onToggleBookmark={onToggleBookmark}
                      onToggleRead={onToggleRead}
                      theme={theme}
                      textSize={textSize}
                    />
                  </motion.div>
                )),
              ])}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
