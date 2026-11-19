import type { SessionRow } from './types';

export const CALENDAR_WEEKS = 12;
export const DAYS_PER_WEEK = 7;

export type ActivityLevel = 0 | 1 | 2 | 3;

export interface CalendarDay {
  /** Local calendar date key, YYYY-MM-DD. */
  dateKey: string;
  /** Local midnight Date for this day. */
  date: Date;
  /** 0 = Mon .. 6 = Sun. */
  dayOfWeek: number;
  /** Total cards reviewed (sum of SessionRow.reviewed) for sessions finished on this local day. */
  cards: number;
  /** Number of sessions finished on this local day. */
  sessions: number;
  /** Shading bucket: 0 (0), 1 (1-5), 2 (6-15), 3 (16+). */
  level: ActivityLevel;
  /** True for today's local date. */
  isToday: boolean;
  /** True for days after today in the current week. */
  isFuture: boolean;
  /** Accessible label, e.g. "Nov 19: 12 cards". */
  ariaLabel: string;
}

export interface CalendarWeek {
  /** 0 (oldest week) .. weekCount - 1 (current week). */
  index: number;
  /** Seven local days ordered Mon..Sun. */
  days: CalendarDay[];
  /** Short English month name shown above this column when a month starts here. */
  monthLabel: string | null;
}

export interface PracticeCalendarData {
  weeks: CalendarWeek[];
  currentStreak: number;
  bestStreak: number;
  todayKey: string;
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Format a Date as a local calendar key (YYYY-MM-DD). */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Step by `deltaDays` in local calendar time (DST-safe). */
export function addLocalDays(date: Date, deltaDays: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + deltaDays);
}

/** Monday 00:00 local time of the week containing `date`. */
export function startOfLocalWeek(date: Date): Date {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (midnight.getDay() + 6) % 7;
  return addLocalDays(midnight, -mondayOffset);
}

/** Map a day's reviewed-card count into 0 / 1-5 / 6-15 / 16+ buckets. */
export function activityLevelFor(cards: number): ActivityLevel {
  if (cards <= 0) return 0;
  if (cards <= 5) return 1;
  if (cards <= 15) return 2;
  return 3;
}

/** Format a local Date as e.g. "Nov 19" in English regardless of browser locale. */
export function formatShortDate(date: Date): string {
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/** Format the accessible label for a calendar cell, e.g. "Nov 19: 12 cards". */
export function formatCellAriaLabel(date: Date, cards: number): string {
  return `${formatShortDate(date)}: ${cards} ${cards === 1 ? 'card' : 'cards'}`;
}

function parseLocalDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Compute current and best streaks from a set of local YYYY-MM-DD keys with
 * at least one finished session. Current streak counts consecutive local days
 * ending today, or ending yesterday if no session has finished today yet.
 */
export function computeStreaks(
  activeDayKeys: ReadonlySet<string>,
  now: Date
): { currentStreak: number; bestStreak: number } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = toLocalDateKey(today);

  let currentStreak = 0;
  let cursor = activeDayKeys.has(todayKey) ? today : addLocalDays(today, -1);
  while (activeDayKeys.has(toLocalDateKey(cursor))) {
    currentStreak++;
    cursor = addLocalDays(cursor, -1);
  }

  const sorted = Array.from(activeDayKeys)
    .filter((key) => key <= todayKey)
    .sort();

  let bestStreak = 0;
  let run = 0;
  let expectedNextKey: string | null = null;

  for (const key of sorted) {
    if (key === expectedNextKey) {
      run++;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
    expectedNextKey = toLocalDateKey(addLocalDays(parseLocalDateKey(key), 1));
  }

  return { currentStreak, bestStreak };
}

/**
 * Build the last `weekCount` local weeks (7 rows Mon..Sun x `weekCount` columns)
 * along with daily card totals and current/best streaks.
 */
export function buildPracticeCalendar(
  sessions: readonly SessionRow[],
  now = new Date(),
  weekCount = CALENDAR_WEEKS
): PracticeCalendarData {
  const safeWeekCount = Math.max(1, Math.floor(weekCount));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = toLocalDateKey(today);

  const cardsByDay = new Map<string, number>();
  const sessionsByDay = new Map<string, number>();

  for (const session of sessions) {
    const finished = new Date(session.finished_at);
    if (Number.isNaN(finished.getTime())) continue;
    const key = toLocalDateKey(finished);
    sessionsByDay.set(key, (sessionsByDay.get(key) ?? 0) + 1);
    const reviewed = Number.isFinite(session.reviewed) && session.reviewed > 0 ? session.reviewed : 0;
    cardsByDay.set(key, (cardsByDay.get(key) ?? 0) + reviewed);
  }

  const activeDayKeys = new Set<string>(sessionsByDay.keys());
  const { currentStreak, bestStreak } = computeStreaks(activeDayKeys, today);

  const currentWeekMonday = startOfLocalWeek(today);
  const gridStartMonday = addLocalDays(currentWeekMonday, -(safeWeekCount - 1) * DAYS_PER_WEEK);

  const rawWeeks: { index: number; days: CalendarDay[]; mondayMonth: number }[] = [];
  for (let w = 0; w < safeWeekCount; w++) {
    const weekMonday = addLocalDays(gridStartMonday, w * DAYS_PER_WEEK);
    const days: CalendarDay[] = [];
    for (let d = 0; d < DAYS_PER_WEEK; d++) {
      const date = addLocalDays(weekMonday, d);
      const dateKey = toLocalDateKey(date);
      const isToday = dateKey === todayKey;
      const isFuture = dateKey > todayKey;
      const cards = isFuture ? 0 : (cardsByDay.get(dateKey) ?? 0);
      const daySessions = isFuture ? 0 : (sessionsByDay.get(dateKey) ?? 0);
      days.push({
        dateKey,
        date,
        dayOfWeek: d,
        cards,
        sessions: daySessions,
        level: activityLevelFor(cards),
        isToday,
        isFuture,
        ariaLabel: formatCellAriaLabel(date, cards),
      });
    }
    rawWeeks.push({ index: w, days, mondayMonth: weekMonday.getMonth() });
  }

  const monthLabels: (string | null)[] = Array(safeWeekCount).fill(null);
  let lastLabeledCol = -Infinity;
  for (let w = 0; w < safeWeekCount; w++) {
    const month = rawWeeks[w].mondayMonth;
    const prevMonth = w > 0 ? rawWeeks[w - 1].mondayMonth : -1;
    const isMonthStart = w === 0 || month !== prevMonth;
    if (!isMonthStart) continue;
    if (w === 0 && safeWeekCount > 1 && rawWeeks[1].mondayMonth !== month) continue;
    if (w - lastLabeledCol < 2) continue;
    monthLabels[w] = MONTH_SHORT[month];
    lastLabeledCol = w;
  }

  const weeks: CalendarWeek[] = rawWeeks.map((week, i) => ({
    index: week.index,
    days: week.days,
    monthLabel: monthLabels[i],
  }));

  return {
    weeks,
    currentStreak,
    bestStreak,
    todayKey,
  };
}
