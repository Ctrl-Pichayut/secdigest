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
  const [globalThai, setGlobalThai] = useState<boolean>(false);

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
    <div className="max-w-md mx-auto min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col pb-16 selection:bg-amber-200">
      {/* Friendly Conversational Header */}
      <header className="px-5 pt-6 pb-4 bg-[#FAF7F2] border-b border-stone-200/80">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 via-rose-400 to-violet-500 flex items-center justify-center text-white shadow-md shadow-rose-400/20 text-lg">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200/90">
                  ☀️ Morning Drop
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-slate-950 via-rose-950 to-violet-950 bg-clip-text text-transparent leading-tight mt-0.5">
                SecDigest
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Global Language Toggle */}
            <motion.button
              type="button"
              data-testid="btn-global-lang"
              onClick={() => setGlobalThai((prev) => !prev)}
              whileTap={{ scale: 0.92 }}
              whileHover={{ y: -1 }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all touch-manipulation cursor-pointer ${
                globalThai
                  ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                  : 'bg-white/90 text-stone-700 hover:text-stone-900 border-stone-200/90 shadow-2xs'
              }`}
              aria-label="Toggle all cards language"
            >
              <span>{globalThai ? '🇬🇧 EN All' : '🇹🇭 TH All'}</span>
            </motion.button>

            {/* Refresh Button */}
            <motion.button
              type="button"
              data-testid="btn-refresh"
              onClick={() => loadNews(true)}
              disabled={refreshing}
              whileTap={{ scale: 0.92 }}
              whileHover={{ y: -1 }}
              className="p-2.5 rounded-2xl text-stone-600 hover:text-stone-900 bg-white/90 hover:bg-white border border-stone-200/90 shadow-xs transition-all touch-manipulation cursor-pointer"
              aria-label="Refresh feed"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-rose-500' : ''}`} />
            </motion.button>
          </div>
        </div>

        <p className="text-xs text-stone-500 font-medium mb-3 pl-1">
          {formattedDate} • Daily CS, Security & AI Intelligence
        </p>

        {/* Interactive Daily Progress Bar */}
        <div className="bg-white/90 rounded-2xl p-3.5 border border-stone-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-stone-700">
            <span data-testid="progress-text">
              {totalCount > 0 && totalReadCount === totalCount
                ? `All ${totalCount} posts caught up today! 🎉`
                : `${totalReadCount} of ${totalCount} posts caught up today 🎉`}
            </span>
            <span
              data-testid="unread-counter"
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                unreadCount > 0
                  ? 'bg-rose-100 text-rose-700 border-rose-200'
                  : 'bg-emerald-100 text-emerald-700 border-emerald-200'
              }`}
            >
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </span>
          </div>

          {/* Animated gradient bar */}
          <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden border border-stone-200/60">
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

      {/* Sticky Category Filter Bar */}
      <nav
        aria-label="Category navigation"
        className="sticky top-0 z-30 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-stone-200/80 px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-2xs"
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
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15 border border-slate-900'
                  : 'bg-white/90 text-stone-600 border border-stone-200/90 hover:bg-white hover:text-stone-900 shadow-2xs'
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
          <div className="flex items-center justify-between px-1 text-xs text-stone-500 pb-1">
            <span className="font-medium">
              Showing {unreadItems.length} unread {unreadItems.length === 1 ? 'post' : 'posts'}
            </span>
            <button
              type="button"
              data-testid="btn-mark-all-read"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors active:scale-95 touch-manipulation cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-3xl bg-rose-50 border border-rose-200 p-4 text-center my-4 shadow-xs">
            <p className="text-xs text-rose-700 font-semibold mb-2.5">{error}</p>
            <button
              type="button"
              onClick={() => loadNews()}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-xs hover:bg-rose-700 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Skeleton Loading State */}
        {loading && (
          <div className="space-y-3.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-3xl bg-white/80 border border-stone-200/80 p-5 space-y-3 animate-pulse shadow-xs"
              >
                <div className="flex justify-between items-center">
                  <div className="w-28 h-6 bg-stone-200/80 rounded-full" />
                  <div className="w-12 h-4 bg-stone-200/80 rounded" />
                </div>
                <div className="w-4/5 h-5 bg-stone-200/80 rounded-lg" />
                <div className="space-y-1.5">
                  <div className="w-full h-3.5 bg-stone-200/60 rounded" />
                  <div className="w-5/6 h-3.5 bg-stone-200/60 rounded" />
                </div>
                <div className="h-16 bg-stone-100 rounded-2xl" />
                <div className="flex justify-between pt-2 border-t border-stone-200/60">
                  <div className="w-16 h-7 bg-stone-200/80 rounded-xl" />
                  <div className="w-20 h-7 bg-stone-200/80 rounded-xl" />
                  <div className="w-16 h-7 bg-stone-200/80 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredItems.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-stone-200 bg-white/70 p-8 text-center my-8 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 mx-auto flex items-center justify-center text-amber-600 mb-3 text-xl">
              {activeFilter === 'SAVED' ? '🔖' : '✨'}
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {activeFilter === 'SAVED' ? 'No Saved Posts Yet' : 'No Posts in This Topic'}
            </h3>
            <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
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
                  globalThai={globalThai}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Caught Up / Read Posts Collapsible Section */}
        {!loading && readItems.length > 0 && (
          <div className="pt-2">
            <motion.button
              type="button"
              data-testid="read-items-divider"
              onClick={() => setReadDrawerOpen((prev) => !prev)}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/90 hover:bg-white border border-stone-200/90 text-stone-700 transition-all font-bold text-xs touch-manipulation cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <span>Caught Up Posts ({readItems.length})</span>
              </div>
              <span className="text-[11px] text-stone-500 font-semibold flex items-center gap-1">
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
                        globalThai={globalThai}
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
  );
}
