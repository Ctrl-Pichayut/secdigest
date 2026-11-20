import { FilterCategory, NewsItem } from '@/lib/types';
import {
  CoffeeIcon,
  MoonIcon,
  SunIcon,
  type IconComponent,
} from '@/components/icons';

export interface ClientTimeInfo {
  badge: string;
  Icon: IconComponent;
  subtitle: string;
  formattedDate: string;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message?: unknown }).message === 'string' &&
    (err as { message: string }).message.length > 0
  ) {
    return (err as { message: string }).message;
  }
  return 'Unknown error';
}

export function mergeAndSortNewsItems(
  existing: NewsItem[],
  incoming: NewsItem[]
): NewsItem[] {
  const byId = new Map<string, NewsItem>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const readDiff = Number(a.is_read) - Number(b.is_read);
    if (readDiff !== 0) return readDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function getClientTimeInfo(now: Date): ClientTimeInfo {
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

export function filterAndSortFeedItems(
  items: NewsItem[],
  activeFilter: FilterCategory,
  normalizedQuery: string
): NewsItem[] {
  let list: NewsItem[] = [];
  if (activeFilter === 'SAVED') {
    list = items.filter((item) => item.is_bookmarked);
  } else if (activeFilter === 'ALL') {
    list = items;
  } else {
    list = items.filter((item) => item.category === activeFilter);
  }

  if (normalizedQuery) {
    list = list.filter((item) => {
      const searchableFields = [
        item.title,
        item.tldr,
        item.actionable_value,
        item.tldr_th,
      ];
      return searchableFields.some(
        (field) =>
          typeof field === 'string' &&
          field.toLowerCase().includes(normalizedQuery)
      );
    });
  }

  return [...list].sort((a, b) => {
    const readDiff = Number(a.is_read) - Number(b.is_read);
    if (readDiff !== 0) return readDiff;
    if (!a.is_read) {
      const breakingDiff =
        Number(Boolean(b.is_breaking)) - Number(Boolean(a.is_breaking));
      if (breakingDiff !== 0) return breakingDiff;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
