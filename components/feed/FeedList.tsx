'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NewsItem } from '@/lib/types';
import { type FeedDayGroup } from '@/lib/feedDates';
import { type FeedTheme } from '@/lib/feed/constants';
import { type TextSize } from '@/lib/feed/useTextSize';
import NewsCard from '@/components/NewsCard';
import FeedSectionHeader from '@/components/feed/FeedSectionHeader';

export interface FeedListProps {
  groups: FeedDayGroup<NewsItem>[];
  isDusk: boolean;
  theme: FeedTheme;
  textSize?: TextSize;
  onToggleBookmark: (id: string, currentState: boolean) => void;
  onToggleRead: (id: string, currentState: boolean) => void;
}

export default function FeedList({
  groups,
  isDusk,
  theme,
  textSize = 'sm',
  onToggleBookmark,
  onToggleRead,
}: FeedListProps) {
  return (
    <AnimatePresence mode="popLayout">
      {groups.flatMap((group, groupIdx) => [
        <motion.div
          key={`unread-header-${group.key}`}
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
            testIdPrefix="unread"
          />
        </motion.div>,
        ...group.items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
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
  );
}
