'use client';

import React, { useMemo } from 'react';
import { useTheme } from '@/lib/ctf/useTheme';
import { useAllProgress, isDone } from '@/lib/ctf/progress';
import { WRITEUPS } from '@/lib/ctf/writeups';
import TodayPracticeCard from '@/components/practice/TodayPracticeCard';
import { useFeed } from '@/lib/feed/useFeed';
import { useTextSize } from '@/lib/feed/useTextSize';
import FeedHeader from '@/components/feed/FeedHeader';
import FilterTabs from '@/components/feed/FilterTabs';
import FeedSearchBar from '@/components/feed/FeedSearchBar';
import FeedStatusBar from '@/components/feed/FeedStatusBar';
import FeedErrorState from '@/components/feed/FeedErrorState';
import FeedSkeleton from '@/components/feed/FeedSkeleton';
import EmptyState from '@/components/feed/EmptyState';
import FeedList from '@/components/feed/FeedList';
import ReadDrawer from '@/components/feed/ReadDrawer';
import LoadOlderFooter from '@/components/feed/LoadOlderFooter';
import UndoSnackbar from '@/components/feed/UndoSnackbar';

export default function HomePage() {
  const feed = useFeed();

  // Shared reading-theme store - stays in sync with the Solved CTF pages.
  const { theme, isDusk, toggle: toggleTheme } = useTheme();
  const { size: textSize, cycle: cycleTextSize } = useTextSize();

  // Learning progress across the interactive labs (for the header tally).
  const allProgress = useAllProgress();
  const labsDone = useMemo(
    () => WRITEUPS.filter((w) => isDone(allProgress[w.slug])).length,
    [allProgress]
  );

  const focusRingClass = isDusk
    ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E1B29]'
    : 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A2623] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E5DFD3]';

  return (
    <div
      className={`min-h-screen w-full transition-colors duration-200 ${
        isDusk ? 'bg-[#1E1B29] text-[#EAE6F2]' : 'bg-[#E5DFD3] text-[#2A2623]'
      }`}
    >
      <div
        className={`max-w-md mx-auto min-h-screen flex flex-col pb-36 transition-colors duration-200 ${
          isDusk
            ? 'bg-[#1E1B29] text-[#EAE6F2] selection:bg-purple-900'
            : 'bg-[#E5DFD3] text-[#2A2623] selection:bg-amber-200'
        }`}
      >
        {/* Friendly Conversational Header with Eye-Comfort Palette */}
        <FeedHeader
          isDusk={isDusk}
          focusRingClass={focusRingClass}
          clientTime={feed.clientTime}
          freshness={feed.freshness}
          isOffline={feed.isOffline}
          pendingSyncCount={feed.pendingSyncCount}
          labsDone={labsDone}
          totalLabs={WRITEUPS.length}
          refreshing={feed.refreshing}
          onToggleTheme={toggleTheme}
          onRefresh={() => feed.loadNews(true)}
          isProgressLoading={feed.isProgressLoading}
          isAllCaughtUp={feed.isAllCaughtUp}
          totalCount={feed.totalCount}
          totalReadCount={feed.totalReadCount}
          unreadCount={feed.unreadCount}
          percentRead={feed.percentRead}
          error={feed.error}
        />

        {/* Sticky Category Filter Bar (Zero glare backdrop) */}
        <FilterTabs
          activeFilter={feed.activeFilter}
          onSelectFilter={feed.setActiveFilter}
          isDusk={isDusk}
          focusRingClass={focusRingClass}
        />

        {/* Feed Content Area */}
        <main className="flex-1 px-4 pt-3 pb-4 space-y-3.5">
          {/* Compact Feed Search (collapsed into an icon button by default) */}
          <FeedSearchBar
            isDusk={isDusk}
            focusRingClass={focusRingClass}
            isSearchOpen={feed.isSearchOpen}
            searchInput={feed.searchInput}
            searchInputRef={feed.searchInputRef}
            searchToggleRef={feed.searchToggleRef}
            onToggleSearch={feed.handleToggleSearch}
            onSearchInputChange={feed.setSearchInput}
            onSearchKeyDown={feed.handleSearchKeyDown}
            onClearAndCollapseSearch={feed.handleClearAndCollapseSearch}
            textSize={textSize}
            onCycleTextSize={cycleTextSize}
          />

          {/* Daily coding practice, riding on the morning-feed habit */}
          <TodayPracticeCard isDusk={isDusk} />

          {/* Quick Batch Action Bar / Active Search Results Summary */}
          {!feed.loading && (feed.unreadItems.length > 0 || feed.isSearchActive) && (
            <FeedStatusBar
              isDusk={isDusk}
              focusRingClass={focusRingClass}
              isSearchActive={feed.isSearchActive}
              filteredCount={feed.filteredItems.length}
              visibleUnreadCount={feed.unreadItems.length}
              activeFilter={feed.activeFilter}
              windowDays={feed.windowDays}
              onMarkAllRead={feed.handleMarkAllRead}
            />
          )}

          {/* Error State */}
          {feed.error && (
            <FeedErrorState
              error={feed.error}
              isDusk={isDusk}
              focusRingClass={focusRingClass}
              onRetry={() => feed.loadNews()}
            />
          )}

          {/* Skeleton Loading State (Non-white surfaces) */}
          {feed.loading && <FeedSkeleton isDusk={isDusk} />}

          {/* Empty State */}
          {!feed.loading && feed.filteredItems.length === 0 && (
            <EmptyState
              isDusk={isDusk}
              isSearchActive={feed.isSearchActive}
              trimmedQuery={feed.trimmedQuery}
              activeFilter={feed.activeFilter}
            />
          )}

          {/* Unread News Cards with Framer Motion Layout Animation */}
          {!feed.loading && (
            <FeedList
              groups={feed.unreadGroups}
              isDusk={isDusk}
              theme={theme}
              textSize={textSize}
              onToggleBookmark={feed.handleToggleBookmark}
              onToggleRead={feed.handleToggleRead}
            />
          )}

          {/* Caught Up / Read Posts Collapsible Section (100% Crisp, Never Dimmed) */}
          {!feed.loading && feed.readItems.length > 0 && (
            <ReadDrawer
              readCount={feed.readItems.length}
              readGroups={feed.readGroups}
              isOpen={feed.readDrawerOpen}
              onToggleOpen={feed.handleToggleReadDrawer}
              isDusk={isDusk}
              theme={theme}
              textSize={textSize}
              focusRingClass={focusRingClass}
              onToggleBookmark={feed.handleToggleBookmark}
              onToggleRead={feed.handleToggleRead}
            />
          )}

          {/* Load Older Items Footer (hidden on SAVED) */}
          {!feed.loading &&
            feed.hasLoaded &&
            feed.olderThan !== null &&
            feed.activeFilter !== 'SAVED' && (
              <LoadOlderFooter
                isDusk={isDusk}
                focusRingClass={focusRingClass}
                olderError={feed.olderError}
                noOlderItems={feed.noOlderItems}
                loadingOlder={feed.loadingOlder}
                refreshing={feed.refreshing}
                onLoadOlder={feed.handleLoadOlder}
              />
            )}
        </main>
      </div>

      <UndoSnackbar
        pendingUndo={feed.pendingUndo}
        isDusk={isDusk}
        focusRingClass={focusRingClass}
        onUndo={feed.handleUndo}
        onDismiss={feed.dismissUndo}
      />
    </div>
  );
}
