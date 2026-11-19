'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { NewsItem, FilterCategory } from '@/lib/types';
import Link from 'next/link';
import NewsCard from '@/components/NewsCard';
import { RefreshCw, CheckCheck, ChevronDown, FlaskConical } from 'lucide-react';
import { useTheme } from '@/lib/ctf/useTheme';
import { useAllProgress, isDone } from '@/lib/ctf/progress';
import { WRITEUPS } from '@/lib/ctf/writeups';
import TodayPracticeCard from '@/components/practice/TodayPracticeCard';
import {
  BoltIcon,
  BookmarkIcon,
  CheckIcon,
  CloudIcon,
  CoffeeIcon,
  FlameIcon,
  GiftIcon,
  MoonIcon,
  PartyIcon,
  SparkleIcon,
  SunIcon,
  SunsetIcon,
  TrophyIcon,
  type IconComponent,
} from '@/components/icons';
import {
  groupFeedItemsByDay,
  getFeedFreshness,
  type FeedDayGroup,
} from '@/lib/feedDates';

const FILTER_TABS: { id: FilterCategory; label: string; Icon: IconComponent }[] = [
  { id: 'ALL', label: 'All', Icon: SparkleIcon },
  { id: 'AI_FREE', label: 'Free AI & Credits', Icon: GiftIcon },
  { id: 'CTF_COMPETITION', label: 'CTF & Labs', Icon: TrophyIcon },
  { id: 'CVE_SECURITY', label: 'Hot Bugs (KEV)', Icon: FlameIcon },
  { id: 'DEV_CLOUD', label: 'Dev & Cloud', Icon: CloudIcon },
  { id: 'SAVED', label: 'Saved', Icon: BookmarkIcon },
];

interface ClientTimeInfo {
  badge: string;
  Icon: IconComponent;
  subtitle: string;
  formattedDate: string;
}

const DEFAULT_GREETING_BADGE = 'DAILY DROP';
const DEFAULT_SUBTITLE = 'Daily CS, Security & AI Intelligence';

function getClientTimeInfo(now: Date): ClientTimeInfo {
  const hour = now.getHours();
  let badge = 'EVENING DROP';
  let Icon: IconComponent = MoonIcon;
  let subtitle = 'Evening CS, Security & AI Intelligence';

  if (hour >= 5 && hour < 12) {
    badge = 'MORNING DROP';
    Icon = SunIcon;
    subtitle = 'Daily CS, Security & AI Intelligence';
  } else if (hour >= 12 && hour < 18) {
    badge = 'AFTERNOON DROP';
    Icon = CoffeeIcon;
    subtitle = 'Midday CS, Security & AI Intelligence';
  }

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(now);

  return { badge, Icon, subtitle, formattedDate };
}

interface FeedSectionHeaderProps {
  group: FeedDayGroup<NewsItem>;
  isDusk: boolean;
  testIdPrefix: 'unread' | 'read';
}

function FeedSectionHeader({
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

export default function HomePage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [readDrawerOpen, setReadDrawerOpen] = useState<boolean>(false);

  // Shared reading-theme store — stays in sync with the Solved CTF pages.
  const { theme, isDusk, toggle: toggleTheme } = useTheme();

  // Learning progress across the three interactive labs (for the header tally).
  const allProgress = useAllProgress();
  const labsDone = useMemo(
    () => WRITEUPS.filter((w) => isDone(allProgress[w.slug])).length,
    [allProgress]
  );

  // Populate time-dependent greeting, date, day headers, and freshness only after
  // mount so prerendered HTML matches the initial client render (avoids hydration #418).
  const [now, setNow] = useState<Date | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  useEffect(() => {
    setNow(new Date());
    const syncOnlineStatus = () => {
      setIsOffline(navigator.onLine === false);
    };
    syncOnlineStatus();
    window.addEventListener('online', syncOnlineStatus);
    window.addEventListener('offline', syncOnlineStatus);
    return () => {
      window.removeEventListener('online', syncOnlineStatus);
      window.removeEventListener('offline', syncOnlineStatus);
    };
  }, []);

  const clientTime = useMemo(
    () => (now ? getClientTimeInfo(now) : null),
    [now]
  );

  // Load news items from Supabase
  const loadNews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const { data, error: sbError } = await supabase
        .from('news_items')
        .select('*')
        .order('is_read', { ascending: true })
        .order('created_at', { ascending: false });

      if (sbError) {
        throw sbError;
      }

      setItems((data as NewsItem[]) || []);
    } catch (err: unknown) {
      console.error('Failed to fetch news items from Supabase:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load intelligence feed: ${message}`);
    } finally {
      setNow(new Date());
      setLoading(false);
      setRefreshing(false);
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  // Optimistic Bookmark Toggle
  const handleToggleBookmark = async (id: string, currentState: boolean) => {
    const nextState = !currentState;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_bookmarked: nextState } : item))
    );

    try {
      const { error: updateError } = await supabase
        .from('news_items')
        .update({ is_bookmarked: nextState })
        .eq('id', id);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Failed to update bookmark in Supabase:', err);
      // Revert on failure
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_bookmarked: currentState } : item))
      );
    }
  };

  // Optimistic Read Toggle
  const handleToggleRead = async (id: string, currentState: boolean) => {
    const nextState = !currentState;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_read: nextState } : item))
    );

    try {
      const { error: updateError } = await supabase
        .from('news_items')
        .update({ is_read: nextState })
        .eq('id', id);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Failed to update read status in Supabase:', err);
      // Revert on failure
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: currentState } : item))
      );
    }
  };

  // Mark all currently visible as read
  const handleMarkAllRead = async () => {
    const unreadFiltered = filteredItems.filter((i) => !i.is_read);
    if (unreadFiltered.length === 0) return;

    const unreadIds = unreadFiltered.map((i) => i.id);

    setItems((prev) =>
      prev.map((item) => (unreadIds.includes(item.id) ? { ...item, is_read: true } : item))
    );

    try {
      const { error: updateError } = await supabase
        .from('news_items')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      loadNews();
    }
  };

  // Filter items based on active tab
  const filteredItems = useMemo(() => {
    let list: NewsItem[] = [];
    if (activeFilter === 'SAVED') {
      list = items.filter((item) => item.is_bookmarked);
    } else if (activeFilter === 'ALL') {
      list = items;
    } else {
      list = items.filter((item) => item.category === activeFilter);
    }

    return [...list].sort((a, b) => {
      const readDiff = Number(a.is_read) - Number(b.is_read);
      if (readDiff !== 0) return readDiff;
      if (!a.is_read) {
        const breakingDiff = Number(Boolean(b.is_breaking)) - Number(Boolean(a.is_breaking));
        if (breakingDiff !== 0) return breakingDiff;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items, activeFilter]);

  const unreadItems = useMemo(() => filteredItems.filter((i) => !i.is_read), [filteredItems]);
  const readItems = useMemo(() => filteredItems.filter((i) => i.is_read), [filteredItems]);

  const unreadGroups = useMemo(
    () =>
      !loading && now
        ? groupFeedItemsByDay(unreadItems, now, { separateBreaking: true })
        : [],
    [unreadItems, now, loading]
  );

  const readGroups = useMemo(
    () => (!loading && now ? groupFeedItemsByDay(readItems, now) : []),
    [readItems, now, loading]
  );

  const freshness = useMemo(
    () => (!loading && now ? getFeedFreshness(items, now) : null),
    [items, now, loading]
  );

  const unreadCount = useMemo(() => {
    return items.filter((item) => !item.is_read).length;
  }, [items]);

  const totalCount = items.length;
  const totalReadCount = totalCount - unreadCount;
  const percentRead = totalCount > 0 ? Math.round((totalReadCount / totalCount) * 100) : 0;
  const isProgressLoading = !hasLoaded || (loading && totalCount === 0);
  const isAllCaughtUp = hasLoaded && !loading && totalCount > 0 && unreadCount === 0;
  const GreetingIcon = clientTime ? clientTime.Icon : BoltIcon;
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
        className={`max-w-md mx-auto min-h-screen flex flex-col pb-28 transition-colors duration-200 ${
          isDusk
            ? 'bg-[#1E1B29] text-[#EAE6F2] selection:bg-purple-900'
            : 'bg-[#E5DFD3] text-[#2A2623] selection:bg-amber-200'
        }`}
      >
        {/* Friendly Conversational Header with Eye-Comfort Palette */}
        <header
          className={`px-5 pt-6 pb-4 border-b transition-colors duration-200 ${
            isDusk ? 'bg-[#1E1B29] border-[#342F46]' : 'bg-[#E5DFD3] border-[#D2C9B8]'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
                <BoltIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    data-testid="time-greeting-badge"
                    className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-2xs ${
                      isDusk
                        ? 'bg-[#2A263A] text-[#D8D2E7] border-[#3E3852]'
                        : 'bg-[#EDE8DF] text-[#4A443E] border-[#D2C9B8]'
                    }`}
                  >
                    <GreetingIcon className="w-3 h-3 shrink-0" />
                    <span>{clientTime ? clientTime.badge : DEFAULT_GREETING_BADGE}</span>
                  </span>
                </div>
                <h1
                  className={`text-2xl font-black tracking-tight leading-tight mt-0.5 ${
                    isDusk ? 'text-[#F0ECF8]' : 'text-[#2A2623]'
                  }`}
                >
                  SecDigest
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Solved CTF labs link */}
              <Link
                href="/solved"
                aria-label={`Solved CTF labs${labsDone > 0 ? `, ${labsDone} of ${WRITEUPS.length} done` : ''}`}
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
                      labsDone === WRITEUPS.length
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-tr from-amber-500 to-rose-500'
                    }`}
                  >
                    {labsDone === WRITEUPS.length ? <CheckIcon className="w-3 h-3" /> : labsDone}
                  </span>
                )}
              </Link>
              {/* Eye-Comfort Theme Toggle Button (Paper / Dusk) */}
              <motion.button
                type="button"
                data-testid="btn-theme-toggle"
                onClick={toggleTheme}
                whileTap={{ scale: 0.92 }}
                whileHover={{ y: -1 }}
                className={`inline-flex items-center justify-center min-h-[40px] px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all touch-manipulation cursor-pointer shadow-xs ${focusRingClass} ${
                  isDusk
                    ? 'bg-[#2A263A] text-[#EAE6F2] border-[#3E3852] hover:bg-[#353048]'
                    : 'bg-[#EDE8DF] text-[#2A2623] border-[#D2C9B8] hover:bg-[#E2DBD0]'
                }`}
                aria-label="Toggle Reading Theme"
              >
                <span className="inline-flex items-center gap-1.5">
                  {isDusk ? (
                    <SunsetIcon className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <CoffeeIcon className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{isDusk ? 'Dusk' : 'Paper'}</span>
                </span>
              </motion.button>

              {/* Refresh Button */}
              <motion.button
                type="button"
                data-testid="btn-refresh"
                onClick={() => loadNews(true)}
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
            {freshness && (
              <p
                data-testid="feed-freshness"
                className={`text-[11px] leading-4 ${
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
              </p>
            )}
            {isOffline && (
              <p
                data-testid="offline-notice"
                className={`text-[11px] leading-4 font-medium ${
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
                    isDusk ? 'bg-[#1E1B29] border-[#342F46]' : 'bg-[#DCD5C9] border-[#CEC5B4]'
                  }`}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between min-h-[22px] text-xs font-bold">
                  <span data-testid="progress-text" className="inline-flex items-center gap-1.5">
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
                    isDusk ? 'bg-[#1E1B29] border-[#342F46]' : 'bg-[#DCD5C9] border-[#CEC5B4]'
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

        {/* Sticky Category Filter Bar (Zero glare backdrop) */}
        <nav
          aria-label="Category navigation"
          className={`sticky top-0 z-30 backdrop-blur-md border-b px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-2xs transition-colors duration-200 ${
            isDusk ? 'bg-[#1E1B29]/95 border-[#342F46]' : 'bg-[#E5DFD3]/90 border-[#D2C9B8]'
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
                onClick={() => setActiveFilter(tab.id)}
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

        {/* Feed Content Area */}
        <main className="flex-1 px-4 py-4 space-y-3.5">
          {/* Daily coding practice, riding on the morning-feed habit */}
          <TodayPracticeCard isDusk={isDusk} />

          {/* Quick Batch Action Bar when unread items exist */}
          {!loading && unreadItems.length > 0 && (
            <div
              className={`flex items-center justify-between px-1 text-xs pb-1 ${
                isDusk ? 'text-[#D5CEE6]' : 'text-[#5A544E]'
              }`}
            >
              <span className="font-medium">
                Showing {unreadItems.length} unread {unreadItems.length === 1 ? 'post' : 'posts'}
              </span>
              <button
                type="button"
                data-testid="btn-mark-all-read"
                onClick={handleMarkAllRead}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 -mr-2 text-xs font-semibold transition-colors active:scale-95 touch-manipulation cursor-pointer ${focusRingClass} ${
                  isDusk
                    ? 'text-rose-400 hover:text-rose-300'
                    : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                <CheckCheck aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            </div>
          )}

        {/* Error State */}
        {error && (
          <div
            className={`rounded-3xl p-4 text-center my-4 shadow-xs border ${
              isDusk
                ? 'bg-[#3A2528] border-rose-800/60 text-rose-200'
                : 'bg-[#F5E2DE] border-rose-300 text-rose-950'
            }`}
          >
            <p className="text-xs font-semibold mb-2.5">{error}</p>
            <button
              type="button"
              onClick={() => loadNews()}
              className={`inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-xs hover:bg-rose-700 transition-colors cursor-pointer ${focusRingClass}`}
            >
              Retry
            </button>
          </div>
        )}

        {/* Skeleton Loading State (Non-white surfaces) */}
        {loading && (
          <div className="space-y-3.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`rounded-3xl p-5 space-y-3 animate-pulse shadow-xs border ${
                  isDusk
                    ? 'bg-[#2A263A] border-[#3E3852]'
                    : 'bg-[#EDE8DF] border-[#D2C9B8]'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div
                    className={`w-28 h-6 rounded-full ${
                      isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
                    }`}
                  />
                  <div
                    className={`w-12 h-4 rounded ${
                      isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
                    }`}
                  />
                </div>
                <div
                  className={`w-4/5 h-5 rounded-lg ${
                    isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
                  }`}
                />
                <div className="space-y-1.5">
                  <div
                    className={`w-full h-3.5 rounded ${
                      isDusk ? 'bg-[#3E3852]/70' : 'bg-[#DCD5C9]/70'
                    }`}
                  />
                  <div
                    className={`w-5/6 h-3.5 rounded ${
                      isDusk ? 'bg-[#3E3852]/70' : 'bg-[#DCD5C9]/70'
                    }`}
                  />
                </div>
                <div
                  className={`h-16 rounded-2xl ${
                    isDusk ? 'bg-[#161320]' : 'bg-[#E5DFD3]'
                  }`}
                />
                <div
                  className={`flex justify-between pt-2 border-t ${
                    isDusk ? 'border-[#3E3852]' : 'border-[#D2C9B8]'
                  }`}
                >
                  <div
                    className={`w-16 h-7 rounded-xl ${
                      isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
                    }`}
                  />
                  <div
                    className={`w-20 h-7 rounded-xl ${
                      isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
                    }`}
                  />
                  <div
                    className={`w-16 h-7 rounded-xl ${
                      isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredItems.length === 0 && (
          <div
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
              {activeFilter === 'SAVED' ? (
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
              {activeFilter === 'SAVED' ? 'No Saved Posts Yet' : 'No Posts in This Topic'}
            </h3>
            <p
              className={`text-xs max-w-xs mx-auto leading-relaxed ${
                isDusk ? 'text-[#D5CEE6]' : 'text-[#5A544E]'
              }`}
            >
              {activeFilter === 'SAVED'
                ? 'Tap "Save" on any post to keep it handy for quick offline reference.'
                : 'There are currently no items under this topic tag. Check "All" or refresh for today\'s drop.'}
            </p>
          </div>
        )}

        {/* Unread News Cards with Framer Motion Layout Animation */}
        {!loading && (
          <AnimatePresence mode="popLayout">
            {unreadGroups.flatMap((group, groupIdx) => [
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
                    onToggleBookmark={handleToggleBookmark}
                    onToggleRead={handleToggleRead}
                    theme={theme}
                  />
                </motion.div>
              )),
            ])}
          </AnimatePresence>
        )}

        {/* Caught Up / Read Posts Collapsible Section (100% Crisp, Never Dimmed) */}
        {!loading && readItems.length > 0 && (
          <div className="pt-2">
            <motion.button
              type="button"
              data-testid="read-items-divider"
              aria-expanded={readDrawerOpen}
              aria-controls="read-items-drawer"
              onClick={() => setReadDrawerOpen((prev) => !prev)}
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
                <span>Caught Up Posts ({readItems.length})</span>
              </div>
              <span
                className={`text-[11px] font-semibold flex items-center gap-1 ${
                  isDusk ? 'text-[#D5CEE6]' : 'text-[#6A635C]'
                }`}
              >
                {readDrawerOpen ? 'Hide' : 'Tap to expand'}
                <ChevronDown
                  aria-hidden="true"
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    readDrawerOpen ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </motion.button>

            {/* Collapsible Drawer Content */}
            <AnimatePresence>
              {readDrawerOpen && (
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
                            onToggleBookmark={handleToggleBookmark}
                            onToggleRead={handleToggleRead}
                            theme={theme}
                          />
                        </motion.div>
                      )),
                    ])}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
