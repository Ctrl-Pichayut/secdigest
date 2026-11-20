import { FilterCategory } from '@/lib/types';
import {
  BookmarkIcon,
  CloudIcon,
  FlameIcon,
  GiftIcon,
  SparkleIcon,
  TrophyIcon,
  type IconComponent,
} from '@/components/icons';

export type FeedTheme = 'paper' | 'dusk';

export interface FeedFilterTab {
  id: FilterCategory;
  label: string;
  Icon: IconComponent;
}

export const FILTER_TABS: FeedFilterTab[] = [
  { id: 'ALL', label: 'All', Icon: SparkleIcon },
  { id: 'AI_FREE', label: 'Free AI & Credits', Icon: GiftIcon },
  { id: 'CTF_COMPETITION', label: 'CTF & Labs', Icon: TrophyIcon },
  { id: 'CVE_SECURITY', label: 'Hot Bugs (KEV)', Icon: FlameIcon },
  { id: 'DEV_CLOUD', label: 'Dev & Cloud', Icon: CloudIcon },
  { id: 'SAVED', label: 'Saved', Icon: BookmarkIcon },
];

export const DEFAULT_GREETING_BADGE = 'DAILY DROP';
export const DEFAULT_SUBTITLE = 'Daily CS, Security & AI Intelligence';
export const WINDOW_STEP_DAYS = 14;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MAX_CONSECUTIVE_EMPTY_PAGES = 2;
export const AUTO_REFRESH_STALE_MS = 30 * 60 * 1000;
export const SEARCH_DEBOUNCE_MS = 150;

export type NavigatorWithBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};
