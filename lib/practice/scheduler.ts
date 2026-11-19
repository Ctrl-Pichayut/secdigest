import { createEmptyCard, fsrs, generatorParameters, type Card, type Grade } from 'ts-fsrs';
import type { FsrsState, Lang, PracticeCard, ReviewRow, SessionMode, SessionRow } from './types';
import { ACTIVE_LANGS, LANGS } from './types';

/**
 * Spaced-repetition scheduling on top of FSRS (ts-fsrs). Cards you keep
 * getting right come back at growing intervals; cards you miss come back
 * soon. Being away for a while never piles up: each session is capped, and
 * the most-forgotten cards (lowest retrievability) are picked first.
 */

const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 365,
    enable_fuzz: true,
  })
);

type CardInputLike = Parameters<typeof scheduler.next>[0];

function toInput(state: FsrsState): CardInputLike {
  return state as unknown as CardInputLike;
}

function serialize(card: Card): FsrsState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

/** Apply one answer to a card's scheduling state and return the new review row. */
export function rateCard(card: PracticeCard, prev: ReviewRow | undefined, grade: Grade, now = new Date()): ReviewRow {
  const input = prev ? toInput(prev.fsrs) : createEmptyCard(now);
  const { card: next } = scheduler.next(input, now, grade);
  const fsrsState = serialize(next);
  const iso = now.toISOString();
  return {
    card_id: card.id,
    lang: card.lang,
    due: fsrsState.due,
    fsrs: fsrsState,
    introduced_at: prev?.introduced_at ?? iso,
    updated_at: iso,
  };
}

function retrievability(row: ReviewRow, now: Date): number {
  try {
    return scheduler.get_retrievability(toInput(row.fsrs), now, false);
  } catch {
    return 0;
  }
}

// --- sessions ---------------------------------------------------------------

export const SESSION_SIZES = [
  { minutes: 2, cards: 4, label: '2 min' },
  { minutes: 5, cards: 10, label: '5 min' },
  { minutes: 15, cards: 25, label: '15 min' },
] as const;

export type LangWeights = Record<Lang, number>;

export interface SessionItem {
  card: PracticeCard;
  isNew: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick `slots` unseen cards, weighted by language, each language in topic order. */
function pickNew(pool: PracticeCard[], reviews: Record<string, ReviewRow>, slots: number, mode: SessionMode, weights: LangWeights): PracticeCard[] {
  const queues = new Map<Lang, PracticeCard[]>();
  for (const lang of ACTIVE_LANGS) {
    queues.set(lang, pool.filter((c) => c.lang === lang && !reviews[c.id]));
  }
  const useWeights = mode === 'mixed' && ACTIVE_LANGS.length > 1;
  const picked: PracticeCard[] = [];
  for (let s = 0; s < slots; s++) {
    // Single-language sessions (or a single active language) ignore weights;
    // mixed sessions draw a language per slot with probability proportional to its weight.
    const candidates = ACTIVE_LANGS.filter((l) => (queues.get(l)?.length ?? 0) > 0 && (!useWeights || weights[l] > 0));
    if (candidates.length === 0) break;
    let lang = candidates[0];
    if (useWeights && candidates.length > 1) {
      const total = candidates.reduce((sum, l) => sum + weights[l], 0);
      let r = Math.random() * total;
      for (const l of candidates) {
        r -= weights[l];
        if (r <= 0) {
          lang = l;
          break;
        }
      }
    }
    picked.push(queues.get(lang)!.shift()!);
  }
  return picked;
}

/**
 * Build one session: due reviews first (most forgotten first), then up to
 * `newLimit` new cards in the remaining slots. The result is shuffled so
 * languages and topics interleave, but new cards of the same language keep
 * their topic order.
 *
 * When `onlyIds` is provided, the candidate pool (both reviewed and new) is
 * restricted to those card ids; if fewer than `cardCount` of them are due,
 * remaining reviewed cards in `onlyIds` are included for early review.
 */
export function buildSession(opts: {
  cards: PracticeCard[];
  reviews: Record<string, ReviewRow>;
  mode: SessionMode;
  cardCount: number;
  newLimit: number;
  weights: LangWeights;
  now?: Date;
  onlyIds?: string[];
}): SessionItem[] {
  const { cards, reviews, mode, cardCount, newLimit, weights, onlyIds } = opts;
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const allowed = onlyIds !== undefined ? new Set(onlyIds) : null;
  const active = cards.filter((c) => ACTIVE_LANGS.includes(c.lang) && (!allowed || allowed.has(c.id)));
  const pool = mode === 'mixed' ? active : active.filter((c) => c.lang === mode);

  const isDue = (c: PracticeCard) => Boolean(reviews[c.id]) && new Date(reviews[c.id].due).getTime() <= nowMs;

  const due = pool
    .filter(isDue)
    .map((c) => ({ c, r: retrievability(reviews[c.id], now) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, cardCount)
    .map(({ c }) => c);

  const early =
    allowed && due.length < cardCount
      ? pool
          .filter((c) => Boolean(reviews[c.id]) && !isDue(c))
          .map((c) => ({ c, r: retrievability(reviews[c.id], now) }))
          .sort((a, b) => a.r - b.r)
          .slice(0, cardCount - due.length)
          .map(({ c }) => c)
      : [];

  const reviewed = [...due, ...early];
  const slots = Math.max(0, Math.min(newLimit, cardCount - reviewed.length));
  const fresh = pickNew(pool, reviews, slots, mode, weights);

  const items = shuffle<SessionItem>([
    ...reviewed.map((card) => ({ card, isNew: false })),
    ...fresh.map((card) => ({ card, isNew: true })),
  ]);

  // Restore topic order among new cards of the same language.
  for (const lang of ACTIVE_LANGS) {
    const positions = items.map((it, i) => (it.isNew && it.card.lang === lang ? i : -1)).filter((i) => i >= 0);
    const ordered = fresh.filter((c) => c.lang === lang);
    positions.forEach((pos, k) => {
      items[pos] = { card: ordered[k], isNew: true };
    });
  }
  return items;
}

// --- stats ------------------------------------------------------------------

/** Monday 00:00 local time of the week containing `now`. */
export function startOfWeek(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d;
}

export interface LangStats {
  total: number;
  seen: number;
  due: number;
  unseen: number;
}

export interface PracticeStats {
  perLang: Record<Lang, LangStats>;
  dueTotal: number;
  unseenTotal: number;
  weekSessions: number;
  practicedToday: boolean;
}

export function computeStats(cards: PracticeCard[], reviews: Record<string, ReviewRow>, sessions: SessionRow[], now = new Date()): PracticeStats {
  const perLang = Object.fromEntries(LANGS.map((l) => [l, { total: 0, seen: 0, due: 0, unseen: 0 }])) as Record<Lang, LangStats>;
  for (const c of cards) {
    if (!ACTIVE_LANGS.includes(c.lang)) continue;
    const s = perLang[c.lang];
    s.total++;
    const r = reviews[c.id];
    if (!r) {
      s.unseen++;
    } else {
      s.seen++;
      if (new Date(r.due) <= now) s.due++;
    }
  }
  const weekStart = startOfWeek(now).getTime();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const finished = sessions.map((s) => new Date(s.finished_at).getTime());
  return {
    perLang,
    dueTotal: ACTIVE_LANGS.reduce((sum, l) => sum + perLang[l].due, 0),
    unseenTotal: ACTIVE_LANGS.reduce((sum, l) => sum + perLang[l].unseen, 0),
    weekSessions: finished.filter((t) => t >= weekStart).length,
    practicedToday: finished.some((t) => t >= todayStart.getTime()),
  };
}
