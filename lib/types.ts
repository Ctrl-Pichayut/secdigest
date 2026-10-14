export type NewsCategory = 'AI_FREE' | 'CVE_SECURITY' | 'CTF_COMPETITION' | 'DEV_CLOUD';

export interface NewsItem {
  id: string;
  source_id: string;
  category: NewsCategory;
  title: string;
  tldr: string;
  actionable_value: string;
  url: string;
  event_start_date: string | null;
  is_bookmarked: boolean;
  is_read: boolean;
  created_at: string;
}

export type FilterCategory = 'ALL' | 'AI_FREE' | 'CTF_COMPETITION' | 'CVE_SECURITY' | 'DEV_CLOUD' | 'SAVED';
