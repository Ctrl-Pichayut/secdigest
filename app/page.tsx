'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { NewsItem, FilterCategory } from '@/lib/types';
import NewsCard from '@/components/NewsCard';
import { RefreshCw, CheckCheck, ChevronDown } from 'lucide-react';

const FILTER_TABS: { id: FilterCategory; label: string }[] = [
  { id: 'ALL', label: '✨ All' },
  { id: 'AI_FREE', label: '🎁 Free AI & Credits' },
  { id: 'CTF_COMPETITION', label: '🏆 CTF & Labs' },
  { id: 'CVE_SECURITY', label: '🔥 Hot Bugs (KEV)' },
  { id: 'DEV_CLOUD', label: '☁️ Dev & Cloud' },
  { id: 'SAVED', label: '🔖 Saved' },
];

export default function HomePage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [readDrawerOpen, setReadDrawerOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'paper' | 'dusk'>('paper');

  // Load persisted theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem('secdigest_theme');
      if (saved === 'dusk' || saved === 'paper') {
        setTheme(saved);
      }
    } catch {
      // ignore storage access errors
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'paper' ? 'dusk' : 'paper';
    setTheme(nextTheme);
    try {
      localStorage.setItem('secdigest_theme', nextTheme);
    } catch {
      // ignore
    }
  };

  const isDusk = theme === 'dusk';

  // Sync body background color, text color, and meta theme-color with active theme
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const bgColor = isDusk ? '#1E1B29' : '#E5DFD3';
      const textColor = isDusk ? '#EAE6F2' : '#2A2623';
      document.body.style.backgroundColor = bgColor;
      document.body.style.color = textColor;
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', bgColor);
      }
    }
  }, [isDusk]);

  // Time-aware greeting badge based on user's local hour
  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return {
        badge: '☀️ MORNING DROP',
        subtitle: 'Daily CS, Security & AI Intelligence',
      };
    }
    if (hour >= 12 && hour < 18) {
      return {
        badge: '☕ AFTERNOON DROP',
        subtitle: 'Midday CS, Security & AI Intelligence',
      };
    }
    return {
      badge: '🌙 EVENING DROP',
      subtitle: 'Evening CS, Security & AI Intelligence',
    };
  }, []);

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
      setLoading(false);
      setRefreshing(false);
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
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items, activeFilter]);

  const unreadItems = useMemo(() => filteredItems.filter((i) => !i.is_read), [filteredItems]);
  const readItems = useMemo(() => filteredItems.filter((i) => i.is_read), [filteredItems]);

  const unreadCount = useMemo(() => {
    return items.filter((item) => !item.is_read).length;
  }, [items]);

  const totalCount = items.length;
  const totalReadCount = totalCount - unreadCount;
  const percentRead = totalCount > 0 ? Math.round((totalReadCount / totalCount) * 100) : 0;

  // Formatted Date
  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  }, []);

  return (
    <div
      className={`min-h-screen w-full transition-colors duration-200 ${
        isDusk ? 'bg-[#1E1B29] text-[#EAE6F2]' : 'bg-[#E5DFD3] text-[#2A2623]'
      }`}
    >
      <div
        className={`max-w-md mx-auto min-h-screen flex flex-col pb-16 transition-colors duration-200 ${
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
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20 text-lg">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    data-testid="time-greeting-badge"
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-2xs ${
                      isDusk
                        ? 'bg-[#2A263A] text-[#D8D2E7] border-[#3E3852]'
                        : 'bg-[#EDE8DF] text-[#4A443E] border-[#D2C9B8]'
                    }`}
                  >
                    {timeGreeting.badge}
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
              {/* Eye-Comfort Theme Toggle Button (Paper / Dusk) */}
              <motion.button
                type="button"
                data-testid="btn-theme-toggle"
                onClick={toggleTheme}
                whileTap={{ scale: 0.92 }}
                whileHover={{ y: -1 }}
                className={`px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all touch-manipulation cursor-pointer shadow-xs ${
                  isDusk
                    ? 'bg-[#2A263A] text-[#EAE6F2] border-[#3E3852] hover:bg-[#353048]'
                    : 'bg-[#EDE8DF] text-[#2A2623] border-[#D2C9B8] hover:bg-[#E2DBD0]'
                }`}
                aria-label="Toggle Reading Theme"
              >
                <span>{isDusk ? '🌆 Dusk' : '☕ Paper'}</span>
              </motion.button>

              {/* Refresh Button */}
              <motion.button
                type="button"
                data-testid="btn-refresh"
                onClick={() => loadNews(true)}
                disabled={refreshing}
                whileTap={{ scale: 0.92 }}
                whileHover={{ y: -1 }}
                className={`p-2.5 rounded-2xl border shadow-xs transition-all touch-manipulation cursor-pointer ${
                  isDusk
                    ? 'text-[#D8D2E7] hover:text-[#FAF7F2] bg-[#2A263A] hover:bg-[#353048] border-[#3E3852]'
                    : 'text-[#4A443E] hover:text-[#2A2623] bg-[#EDE8DF] hover:bg-[#E2DBD0] border-[#D2C9B8]'
                }`}
                aria-label="Refresh feed"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-rose-500' : ''}`} />
              </motion.button>
            </div>
          </div>

          <p
            className={`text-xs font-medium mb-3 pl-1 ${
              isDusk ? 'text-[#B3ACC5]' : 'text-[#5A544E]'
            }`}
          >
            {formattedDate} • {timeGreeting.subtitle}
          </p>

          {/* Interactive Daily Progress Bar */}
          <div
            className={`rounded-2xl p-3.5 border shadow-xs space-y-2 ${
              isDusk
                ? 'bg-[#2A263A] border-[#3E3852] text-[#F0ECF8]'
                : 'bg-[#EDE8DF] border-[#D8D0C0] text-[#2A2623]'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span data-testid="progress-text">
                {totalCount > 0 && totalReadCount === totalCount
                  ? `All ${totalCount} posts caught up today! 🎉`
                  : `${totalReadCount} of ${totalCount} posts caught up today 🎉`}
              </span>
              <span
                data-testid="unread-counter"
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  unreadCount > 0
                    ? isDusk
                      ? 'bg-rose-950/70 text-rose-200 border-rose-700/60'
                      : 'bg-rose-200/90 text-rose-950 border-rose-300'
                    : isDusk
                    ? 'bg-emerald-950/70 text-emerald-200 border-emerald-700/60'
                    : 'bg-emerald-200/90 text-emerald-950 border-emerald-300'
                }`}
              >
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
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
            return (
              <motion.button
                key={tab.id}
                type="button"
                data-testid={`filter-${tab.id.toLowerCase()}`}
                onClick={() => setActiveFilter(tab.id)}
                whileTap={{ scale: 0.94 }}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all touch-manipulation cursor-pointer ${
                  isActive
                    ? isDusk
                      ? 'bg-[#F0ECF8] text-[#1E1B29] shadow-sm border border-[#F0ECF8]'
                      : 'bg-[#2A2623] text-[#FAF7F2] shadow-sm border border-[#2A2623]'
                    : isDusk
                    ? 'bg-[#2A263A] text-[#D5CEE6] border border-[#3E3852] hover:bg-[#353048] hover:text-[#FAF7F2]'
                    : 'bg-[#EDE8DF] text-[#5A544E] border border-[#D2C9B8] hover:bg-[#E2DBD0] hover:text-[#2A2623]'
                }`}
              >
                {tab.label}
              </motion.button>
            );
          })}
        </nav>

        {/* Feed Content Area */}
        <main className="flex-1 px-4 py-4 space-y-3.5">
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
                className={`flex items-center gap-1 text-xs font-semibold transition-colors active:scale-95 touch-manipulation cursor-pointer ${
                  isDusk
                    ? 'text-rose-400 hover:text-rose-300'
                    : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                <CheckCheck className="w-3.5 h-3.5" />
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
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-xs hover:bg-rose-700 transition-colors cursor-pointer"
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
              className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 text-xl border ${
                isDusk
                  ? 'bg-[#352F46] border-[#4A4462] text-amber-300'
                  : 'bg-[#E5DFD3] border-[#D2C9B8] text-amber-800'
              }`}
            >
              {activeFilter === 'SAVED' ? '🔖' : '✨'}
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
            {unreadItems.map((item) => (
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
            ))}
          </AnimatePresence>
        )}

        {/* Caught Up / Read Posts Collapsible Section (100% Crisp, Never Dimmed) */}
        {!loading && readItems.length > 0 && (
          <div className="pt-2">
            <motion.button
              type="button"
              data-testid="read-items-divider"
              onClick={() => setReadDrawerOpen((prev) => !prev)}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all font-bold text-xs touch-manipulation cursor-pointer shadow-xs ${
                isDusk
                  ? 'bg-[#2A263A] hover:bg-[#353048] border-[#3E3852] text-[#F0ECF8]'
                  : 'bg-[#EDE8DF] hover:bg-[#E2DBD0] border-[#D2C9B8] text-[#2A2623]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    isDusk
                      ? 'bg-emerald-950/70 text-emerald-300'
                      : 'bg-emerald-200/90 text-emerald-950'
                  }`}
                >
                  ✓
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
                  data-testid="read-items-drawer"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                  className="space-y-3.5 pt-3 overflow-hidden"
                >
                  {readItems.map((item) => (
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
                  ))}
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
