// Types for the daily coding Practice feature.
//
// Card content is bundled as JSON (lib/practice/cards/*.json) so the starter
// bank works offline and the Python verifier (scripts/verify_practice_cards.py)
// can read the same files. Learner state (FSRS scheduling) lives separately in
// ReviewRow and syncs to Supabase.

export type Lang = 'python' | 'c' | 'js' | 'java';

export const LANGS: Lang[] = ['python', 'c', 'js', 'java'];

export const LANG_META: Record<Lang, { label: string; short: string; emoji: string }> = {
  python: { label: 'Python', short: 'PY', emoji: '🐍' },
  c: { label: 'C', short: 'C', emoji: '⚙️' },
  js: { label: 'JavaScript', short: 'JS', emoji: '🟨' },
  java: { label: 'Java', short: 'JAVA', emoji: '☕' },
};

interface BaseCard {
  /** Stable id, e.g. "py-007". Never reuse or renumber — review history keys on it. */
  id: string;
  lang: Lang;
  /** Topic name; cards are introduced in file order, so topics form a learning path. */
  topic: string;
  /** The question shown above the exercise. */
  prompt: string;
  /** Shown after answering, right or wrong. */
  explanation: string;
  /** Set on cards written by the refill pipeline (stored in public.practice_cards). */
  generated?: boolean;
}

/** Predict what a snippet prints. */
export interface OutputCard extends BaseCard {
  kind: 'output';
  code: string;
  choices: string[];
  answer: number;
  /**
   * Verifier hint. C/Java snippets are wrapped in a main() template unless
   * `full` is true. If `raises` is set, the correct choice is an error name
   * and the program is expected to fail with it.
   */
  full?: boolean;
  raises?: string;
}

/** Tap the line that contains the bug. */
export interface BugCard extends BaseCard {
  kind: 'bug';
  lines: string[];
  bugLine: number;
  /**
   * Verifier hints (required on generated cards): replacing `bugLine` with
   * `fixedLine` must make the program print `expectOutput`.
   */
  fixedLine?: string;
  expectOutput?: string;
  full?: boolean;
}

/** Put shuffled lines back in a working order. */
export interface OrderCard extends BaseCard {
  kind: 'order';
  /** Lines in the CORRECT order, indentation included. */
  lines: string[];
  /** If set, the verifier runs the ordered code and checks it prints this. */
  expectOutput?: string;
  full?: boolean;
}

/**
 * Pick the right way to do something in one language. The wrong choices are
 * usually correct in a DIFFERENT language, which trains telling them apart.
 */
export interface CompareCard extends BaseCard {
  kind: 'compare';
  choices: { code: string; lang: Lang | null }[];
  answer: number;
}

export type PracticeCard = OutputCard | BugCard | OrderCard | CompareCard;

export type CardKind = PracticeCard['kind'];

/** Serialized ts-fsrs Card (dates as ISO strings). */
export interface FsrsState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string | null;
}

/** One row of public.practice_reviews. */
export interface ReviewRow {
  card_id: string;
  lang: Lang;
  due: string;
  fsrs: FsrsState;
  introduced_at: string;
  updated_at: string;
}

/** One row of public.practice_sessions. */
export interface SessionRow {
  id: string;
  started_at: string;
  finished_at: string;
  minutes: number;
  mode: string;
  reviewed: number;
  new_cards: number;
  correct: number;
}

/** 'mixed' uses language weights; a language name means a single-language session. */
export type SessionMode = 'mixed' | Lang;
