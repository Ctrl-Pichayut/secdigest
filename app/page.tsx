'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { NewsItem, FilterCategory } from '@/lib/types';
import NewsCard from '@/components/NewsCard';
import { Shield, Sparkles, RefreshCw, CheckCheck, Bookmark } from 'lucide-react';

const FILTER_TABS: { id: FilterCategory; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'AI_FREE', label: 'Free AI & Credits' },
  { id: 'CTF_COMPETITION', label: 'CTF & Labs' },
  { id: 'CVE_SECURITY', label: 'KEV Alerts' },
  { id: 'DEV_CLOUD', label: 'Dev & Cloud' },
  { id: 'SAVED', label: 'Saved' },
];

export default function HomePage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');

  // Load news items from Supabase
  const loadNews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const { data, error: sbError } = await supabase
        .from('news_items')
        .select('*')
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
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_bookmarked: nextState } : item))
    );

    try {
      const { error: updateError } = await supabase
        .from('news_items')
        .update({ is_bookmarked: nextState })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }
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
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_read: nextState } : item))
    );

    try {
      const { error: updateError } = await supabase
        .from('news_items')
        .update({ is_read: nextState })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }
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

    // Optimistic update
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

  // Filtered Items
  const filteredItems = useMemo(() => {
    if (activeFilter === 'SAVED') {
      return items.filter((item) => item.is_bookmarked);
    }
    if (activeFilter === 'ALL') {
      return items;
    }
    return items.filter((item) => item.category === activeFilter);
  }, [items, activeFilter]);

  const unreadCount = useMemo(() => {
    return items.filter((item) => !item.is_read).length;
  }, [items]);

  // Formatted Date
  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  }, []);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-zinc-950 text-zinc-100 flex flex-col pb-16 selection:bg-zinc-800">
      {/* Top Application Header */}
      <header className="px-4 pt-5 pb-3 border-b border-zinc-800/80 bg-zinc-950">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-sky-500 flex items-center justify-center text-zinc-950 font-black shadow-lg shadow-emerald-500/20">
              <Shield className="w-4 h-4 text-zinc-950 fill-zinc-950" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white leading-none">
                SecDigest
              </h1>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                Morning Intel
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Unread Counter Badge */}
            <span
              data-testid="unread-counter"
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                unreadCount > 0
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
            </span>

            {/* Refresh Button */}
            <button
              type="button"
              data-testid="btn-refresh"
              onClick={() => loadNews(true)}
              disabled={refreshing}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-zinc-800 active:scale-95 transition-all touch-manipulation"
              aria-label="Refresh feed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Date Display */}
        <p className="text-xs text-zinc-400 font-medium pl-10">
          {formattedDate}
        </p>
      </header>

      {/* Sticky Horizontal Pill Category Filter Bar */}
      <nav
        aria-label="Category navigation"
        className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar"
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`filter-${tab.id.toLowerCase()}`}
              onClick={() => setActiveFilter(tab.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 touch-manipulation ${
                isActive
                  ? 'bg-zinc-100 text-zinc-950 shadow-md shadow-zinc-100/10'
                  : 'bg-zinc-900/90 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Feed Content Area */}
      <main className="flex-1 px-4 py-4 space-y-3.5">
        {/* Quick Batch Action Bar when unread items exist */}
        {!loading && filteredItems.some((i) => !i.is_read) && (
          <div className="flex items-center justify-between px-1 text-xs text-zinc-400 pb-1">
            <span>
              Showing {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
            </span>
            <button
              type="button"
              data-testid="btn-mark-all-read"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-colors active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-2xl bg-rose-950/40 border border-rose-800/50 p-4 text-center my-4">
            <p className="text-xs text-rose-300 font-medium mb-2.5">{error}</p>
            <button
              type="button"
              onClick={() => loadNews()}
              className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 text-xs font-semibold border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
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
                className="rounded-2xl bg-zinc-900/40 border border-zinc-800/50 p-4 space-y-3 animate-pulse"
              >
                <div className="flex justify-between items-center">
                  <div className="w-20 h-5 bg-zinc-800 rounded-full" />
                  <div className="w-12 h-4 bg-zinc-800 rounded" />
                </div>
                <div className="w-3/4 h-5 bg-zinc-800 rounded" />
                <div className="space-y-1.5">
                  <div className="w-full h-3.5 bg-zinc-800 rounded" />
                  <div className="w-5/6 h-3.5 bg-zinc-800 rounded" />
                </div>
                <div className="h-16 bg-zinc-800/60 rounded-xl" />
                <div className="flex justify-between pt-2 border-t border-zinc-800/40">
                  <div className="w-16 h-7 bg-zinc-800 rounded-lg" />
                  <div className="w-20 h-7 bg-zinc-800 rounded-lg" />
                  <div className="w-16 h-7 bg-zinc-800 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center my-8">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 mx-auto flex items-center justify-center text-zinc-500 mb-3">
              {activeFilter === 'SAVED' ? (
                <Bookmark className="w-6 h-6 text-amber-400" />
              ) : (
                <Sparkles className="w-6 h-6 text-zinc-500" />
              )}
            </div>
            <h3 className="text-sm font-bold text-zinc-200 mb-1">
              {activeFilter === 'SAVED' ? 'No Saved Items' : 'No Items in This Category'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
              {activeFilter === 'SAVED'
                ? 'Tap "Save" on any news item to save it for quick offline reference during your commute.'
                : 'There are currently no items under this filter. Check "All" or refresh for today\'s digest.'}
            </p>
          </div>
        )}

        {/* Render News Cards */}
        {!loading &&
          filteredItems.map((item) => (
            <NewsCard
              key={item.id}
              item={item}
              onToggleBookmark={handleToggleBookmark}
              onToggleRead={handleToggleRead}
            />
          ))}
      </main>
    </div>
  );
}
