'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { NewsItem, FilterCategory } from '@/lib/types';
import { groupFeedItemsByDay, getFeedFreshness } from '@/lib/feedDates';
import {
  AUTO_REFRESH_STALE_MS,
  MAX_CONSECUTIVE_EMPTY_PAGES,
  MS_PER_DAY,
  SEARCH_DEBOUNCE_MS,
  WINDOW_STEP_DAYS,
  type NavigatorWithBadge,
} from '@/lib/feed/constants';
import {
  filterAndSortFeedItems,
  getClientTimeInfo,
  getErrorMessage,
  mergeAndSortNewsItems,
} from '@/lib/feed/helpers';

export interface PendingUndo {
  ids: string[];
  label: string;
  key: number;
}

function buildUndoLabel(count: number): string {
  return count === 1 ? 'Marked as read' : `Marked ${count} items as read`;
}

export function useFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [successfulLoadCount, setSuccessfulLoadCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [olderThan, setOlderThan] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number>(WINDOW_STEP_DAYS);
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [consecutiveEmptyPages, setConsecutiveEmptyPages] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const [readDrawerOpen, setReadDrawerOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const feedEpochRef = useRef<number>(0);
  const lastSuccessAtRef = useRef<number | null>(null);
  const lastLoadFailedRef = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);
  const hasActiveSearchQueryRef = useRef<boolean>(false);
  const undoKeyRef = useRef<number>(0);
  const handledUndoKeyRef = useRef<number | null>(null);

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

  // Load recent (last 14 days) or still relevant (unread/bookmarked) items from Supabase
  const loadNews = useCallback(async (isRefresh = false) => {
    const epoch = ++feedEpochRef.current;
    inFlightRef.current = true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setOlderError(null);
    setLoadingOlder(false);

    try {
      const cutoffIso = new Date(
        Date.now() - WINDOW_STEP_DAYS * MS_PER_DAY
      ).toISOString();

      const { data, error: sbError } = await supabase
        .from('news_items')
        .select('*')
        .or(`created_at.gte.${cutoffIso},is_bookmarked.eq.true,is_read.eq.false`)
        .order('is_read', { ascending: true })
        .order('created_at', { ascending: false });

      if (sbError) {
        throw sbError;
      }

      if (epoch !== feedEpochRef.current) return;

      setItems((data as NewsItem[]) || []);
      setOlderThan(cutoffIso);
      setWindowDays(WINDOW_STEP_DAYS);
      setConsecutiveEmptyPages(0);
      lastSuccessAtRef.current = Date.now();
      lastLoadFailedRef.current = false;
      setSuccessfulLoadCount((prev) => prev + 1);
    } catch (err: unknown) {
      if (epoch !== feedEpochRef.current) return;
      lastLoadFailedRef.current = true;
      console.error('Failed to fetch news items from Supabase:', err);
      const message = getErrorMessage(err);
      setError(`Failed to load intelligence feed: ${message}`);
    } finally {
      if (epoch === feedEpochRef.current) {
        inFlightRef.current = false;
        setNow(new Date());
        setLoading(false);
        setRefreshing(false);
        setHasLoaded(true);
      }
    }
  }, []);

  const noOlderItems = consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY_PAGES;

  // Fetch the previous 14-day slice of older items and merge without duplicates
  const handleLoadOlder = useCallback(async () => {
    if (!olderThan || loadingOlder || noOlderItems) return;

    const epoch = feedEpochRef.current;
    const currentCutoff = olderThan;
    const nextCutoffIso = new Date(
      new Date(currentCutoff).getTime() - WINDOW_STEP_DAYS * MS_PER_DAY
    ).toISOString();

    setLoadingOlder(true);
    setOlderError(null);

    try {
      const { data, error: sbError } = await supabase
        .from('news_items')
        .select('*')
        .lt('created_at', currentCutoff)
        .gte('created_at', nextCutoffIso)
        .order('is_read', { ascending: true })
        .order('created_at', { ascending: false });

      if (sbError) {
        throw sbError;
      }

      if (epoch !== feedEpochRef.current) return;

      const incoming = (data as NewsItem[]) || [];
      if (incoming.length > 0) {
        setItems((prev) => mergeAndSortNewsItems(prev, incoming));
        setConsecutiveEmptyPages(0);
      } else {
        setConsecutiveEmptyPages((prev) => prev + 1);
      }

      setOlderThan(nextCutoffIso);
      setWindowDays((prev) => prev + WINDOW_STEP_DAYS);
    } catch (err: unknown) {
      if (epoch !== feedEpochRef.current) return;
      console.error('Failed to load older news items from Supabase:', err);
      const message = getErrorMessage(err);
      setOlderError(`Failed to load older items: ${message}`);
    } finally {
      if (epoch === feedEpochRef.current) {
        setLoadingOlder(false);
      }
    }
  }, [olderThan, loadingOlder, noOlderItems]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  // Keep a ref of whether the user has an active search query open so resume listeners stay stable
  useEffect(() => {
    hasActiveSearchQueryRef.current =
      isSearchOpen &&
      (searchInput.trim().length > 0 || debouncedQuery.trim().length > 0);
  }, [isSearchOpen, searchInput, debouncedQuery]);

  // Auto-refresh stale feed when resuming the PWA or regaining connectivity
  useEffect(() => {
    const isLastSuccessStale = () => {
      const lastSuccessAt = lastSuccessAtRef.current;
      return (
        lastSuccessAt !== null &&
        Date.now() - lastSuccessAt > AUTO_REFRESH_STALE_MS
      );
    };

    const maybeAutoRefresh = () => {
      if (
        navigator.onLine === false ||
        inFlightRef.current ||
        hasActiveSearchQueryRef.current
      ) {
        return;
      }
      void loadNews(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (isLastSuccessStale()) {
        maybeAutoRefresh();
      }
    };

    const handleOnline = () => {
      if (lastLoadFailedRef.current || isLastSuccessStale()) {
        maybeAutoRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [loadNews]);

  // Debounce search input by 150ms
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Focus the search input as soon as the search bar expands
  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  const handleToggleSearch = () => {
    if (isSearchOpen) {
      setSearchInput('');
      setDebouncedQuery('');
      setIsSearchOpen(false);
    } else {
      setIsSearchOpen(true);
    }
  };

  const handleClearAndCollapseSearch = () => {
    setSearchInput('');
    setDebouncedQuery('');
    setIsSearchOpen(false);
    searchToggleRef.current?.focus();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (searchInput.length > 0 || debouncedQuery.length > 0) {
        setSearchInput('');
        setDebouncedQuery('');
      } else {
        setIsSearchOpen(false);
        searchToggleRef.current?.focus();
      }
    }
  };

  // Optimistic Bookmark Toggle
  const handleToggleBookmark = async (id: string, currentState: boolean) => {
    const nextState = !currentState;
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_bookmarked: nextState } : item
      )
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
        prev.map((item) =>
          item.id === id ? { ...item, is_bookmarked: currentState } : item
        )
      );
    }
  };

  // Optimistic Read Toggle
  const handleToggleRead = async (id: string, currentState: boolean) => {
    const nextState = !currentState;
    const undoKey = nextState ? ++undoKeyRef.current : null;

    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_read: nextState } : item
      )
    );

    if (undoKey !== null) {
      setPendingUndo({
        ids: [id],
        label: buildUndoLabel(1),
        key: undoKey,
      });
    }

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
        prev.map((item) =>
          item.id === id ? { ...item, is_read: currentState } : item
        )
      );
      if (undoKey !== null) {
        setPendingUndo((prev) => (prev && prev.key === undoKey ? null : prev));
      }
    }
  };

  const trimmedQuery = debouncedQuery.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const isSearchActive = normalizedQuery.length > 0;

  // Filter items based on active tab and search query
  const filteredItems = useMemo(
    () => filterAndSortFeedItems(items, activeFilter, normalizedQuery),
    [items, activeFilter, normalizedQuery]
  );

  // Mark all currently visible as read
  const handleMarkAllRead = async () => {
    const unreadFiltered = filteredItems.filter((i) => !i.is_read);
    if (unreadFiltered.length === 0) return;

    const unreadIds = unreadFiltered.map((i) => i.id);
    const undoKey = ++undoKeyRef.current;

    setItems((prev) =>
      prev.map((item) =>
        unreadIds.includes(item.id) ? { ...item, is_read: true } : item
      )
    );
    setPendingUndo({
      ids: unreadIds,
      label: buildUndoLabel(unreadIds.length),
      key: undoKey,
    });

    try {
      const { error: updateError } = await supabase
        .from('news_items')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      setPendingUndo((prev) => (prev && prev.key === undoKey ? null : prev));
      loadNews();
    }
  };

  const dismissUndo = useCallback(() => {
    setPendingUndo(null);
  }, []);

  const handleUndo = useCallback(async () => {
    if (!pendingUndo || handledUndoKeyRef.current === pendingUndo.key) return;
    handledUndoKeyRef.current = pendingUndo.key;

    const readIdSet = new Set(
      items.filter((item) => item.is_read).map((item) => item.id)
    );
    const idsToRestore = pendingUndo.ids.filter((id) => readIdSet.has(id));

    setPendingUndo(null);

    if (idsToRestore.length === 0) return;

    const restoreSet = new Set(idsToRestore);
    setItems((prev) =>
      prev.map((item) =>
        restoreSet.has(item.id) ? { ...item, is_read: false } : item
      )
    );

    try {
      const { error: updateError } = await supabase
        .from('news_items')
        .update({ is_read: false })
        .in('id', idsToRestore);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Failed to undo read status in Supabase:', err);
      loadNews();
    }
  }, [pendingUndo, items, loadNews]);

  const unreadItems = useMemo(
    () => filteredItems.filter((i) => !i.is_read),
    [filteredItems]
  );
  const readItems = useMemo(
    () => filteredItems.filter((i) => i.is_read),
    [filteredItems]
  );

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

  // Keep the PWA app badge synced with unread items after loads and read/unread changes
  useEffect(() => {
    if (successfulLoadCount === 0) return;
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;

    const nav = navigator as NavigatorWithBadge;
    void (async () => {
      try {
        if (unreadCount > 0) {
          await nav.setAppBadge?.(unreadCount);
        } else if (typeof nav.clearAppBadge === 'function') {
          await nav.clearAppBadge();
        }
      } catch {
        // Ignore unsupported or permission-denied badge errors
      }
    })();
  }, [successfulLoadCount, unreadCount]);

  const totalCount = items.length;
  const totalReadCount = totalCount - unreadCount;
  const percentRead =
    totalCount > 0 ? Math.round((totalReadCount / totalCount) * 100) : 0;
  const isProgressLoading = !hasLoaded || (loading && totalCount === 0);
  const isAllCaughtUp =
    hasLoaded && !loading && totalCount > 0 && unreadCount === 0;

  const handleToggleReadDrawer = () => {
    setReadDrawerOpen((prev) => !prev);
  };

  return {
    loading,
    hasLoaded,
    refreshing,
    error,
    olderThan,
    windowDays,
    loadingOlder,
    olderError,
    noOlderItems,
    activeFilter,
    setActiveFilter,
    readDrawerOpen,
    handleToggleReadDrawer,
    isSearchOpen,
    searchInput,
    setSearchInput,
    trimmedQuery,
    isSearchActive,
    searchInputRef,
    searchToggleRef,
    clientTime,
    isOffline,
    freshness,
    filteredItems,
    unreadItems,
    readItems,
    unreadGroups,
    readGroups,
    unreadCount,
    totalCount,
    totalReadCount,
    percentRead,
    isProgressLoading,
    isAllCaughtUp,
    loadNews,
    handleLoadOlder,
    handleToggleSearch,
    handleClearAndCollapseSearch,
    handleSearchKeyDown,
    handleToggleBookmark,
    handleToggleRead,
    handleMarkAllRead,
    pendingUndo,
    handleUndo,
    dismissUndo,
  };
}
