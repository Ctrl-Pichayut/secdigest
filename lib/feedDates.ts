export interface FeedDateItem {
  created_at: string;
  is_breaking?: boolean | null;
}

export interface FeedDayGroup<T extends FeedDateItem> {
  key: string;
  label: string;
  isBreaking?: boolean;
  items: T[];
}

export interface FeedFreshness {
  text: string;
  isStale: boolean;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const STALE_DIGEST_HOURS = 30;
const STALE_DIGEST_MS = STALE_DIGEST_HOURS * MS_PER_HOUR;

/** Returns a stable local calendar-day key (YYYY-MM-DD) for grouping. */
function getLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes the whole-day difference (now - date) in the user's local calendar,
 * using UTC midnight of each local (year, month, day) so DST shifts never skew it.
 */
function getLocalCalendarDayDiff(date: Date, now: Date): number {
  const dateUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((nowUtc - dateUtc) / MS_PER_DAY);
}

/** Formats a local date as e.g. "Mon, Nov 17" (includes year if different from now). */
function formatShortLocalDay(date: Date, now: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  };
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = 'numeric';
  }
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/** Formats a local calendar day label: "Today", "Yesterday", or e.g. "Mon, Nov 17". */
export function formatLocalDayLabel(date: Date, now: Date): string {
  const diffDays = getLocalCalendarDayDiff(date, now);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return formatShortLocalDay(date, now);
}

/**
 * Groups already-sorted feed items by the local calendar day of `created_at`.
 * When `separateBreaking` is true, breaking items stay at the top under a
 * "Breaking" group regardless of day while preserving their existing sort order.
 */
export function groupFeedItemsByDay<T extends FeedDateItem>(
  items: readonly T[],
  now: Date,
  options?: { separateBreaking?: boolean }
): FeedDayGroup<T>[] {
  const separateBreaking = Boolean(options?.separateBreaking);
  const breakingItems: T[] = [];
  const dayGroups = new Map<string, FeedDayGroup<T>>();

  for (const item of items) {
    if (separateBreaking && Boolean(item.is_breaking)) {
      breakingItems.push(item);
      continue;
    }

    const parsed = new Date(item.created_at);
    const isValidDate = !Number.isNaN(parsed.getTime());
    const key = isValidDate ? getLocalDayKey(parsed) : 'earlier';
    const existing = dayGroups.get(key);

    if (existing) {
      existing.items.push(item);
    } else {
      dayGroups.set(key, {
        key,
        label: isValidDate ? formatLocalDayLabel(parsed, now) : 'Earlier',
        items: [item],
      });
    }
  }

  const groups: FeedDayGroup<T>[] = [];
  if (breakingItems.length > 0) {
    groups.push({
      key: 'breaking',
      label: 'Breaking',
      isBreaking: true,
      items: breakingItems,
    });
  }

  groups.push(...Array.from(dayGroups.values()));
  return groups;
}

/**
 * Computes the header freshness line from the newest `created_at` in loaded items.
 * Flags the digest as stale when the newest item is older than 30 hours.
 */
export function getFeedFreshness(
  items: readonly FeedDateItem[],
  now: Date
): FeedFreshness | null {
  let newestMs = -Infinity;

  for (const item of items) {
    const ms = new Date(item.created_at).getTime();
    if (!Number.isNaN(ms) && ms > newestMs) {
      newestMs = ms;
    }
  }

  if (!Number.isFinite(newestMs)) {
    return null;
  }

  const newestDate = new Date(newestMs);
  const diffMs = now.getTime() - newestMs;
  const dayDiff = getLocalCalendarDayDiff(newestDate, now);

  if (diffMs > STALE_DIGEST_MS) {
    const sinceLabel =
      dayDiff === 1 ? 'yesterday' : formatShortLocalDay(newestDate, now);
    return {
      text: `No new digest since ${sinceLabel}`,
      isStale: true,
    };
  }

  if (diffMs < MS_PER_MINUTE) {
    return { text: 'Updated just now', isStale: false };
  }

  if (diffMs < MS_PER_HOUR) {
    const mins = Math.floor(diffMs / MS_PER_MINUTE);
    return { text: `Updated ${mins}m ago`, isStale: false };
  }

  if (diffMs < MS_PER_DAY) {
    const hours = Math.floor(diffMs / MS_PER_HOUR);
    return { text: `Updated ${hours}h ago`, isStale: false };
  }

  if (dayDiff === 1) {
    return { text: 'Updated yesterday', isStale: false };
  }

  return {
    text: `Updated ${formatShortLocalDay(newestDate, now)}`,
    isStale: false,
  };
}
