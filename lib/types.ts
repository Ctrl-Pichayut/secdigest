export type NewsCategory = 'AI_FREE' | 'CVE_SECURITY' | 'CTF_COMPETITION' | 'DEV_CLOUD';

export interface TechTerm {
  term: string;
  meaning: string;
}

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
  tldr_th?: string | null;
  actionable_value_th?: string | null;
  tech_terms_th?: TechTerm[] | null;
}

export type FilterCategory = 'ALL' | 'AI_FREE' | 'CTF_COMPETITION' | 'CVE_SECURITY' | 'DEV_CLOUD' | 'SAVED';
