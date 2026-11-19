'use client';

import React, { useMemo } from 'react';
import { FlameIcon, TrophyIcon } from '@/components/icons';
import { buildPracticeCalendar, type ActivityLevel } from '@/lib/practice/calendar';
import type { SessionRow } from '@/lib/practice/types';
import { palette } from './ui';

const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'] as const;

const CELL_TONE: Record<ActivityLevel, { paper: string; dusk: string }> = {
  0: {
    paper: 'bg-[#DCD5C9] border-[#CEC5B4]',
    dusk: 'bg-[#1E1B29] border-[#342F46]',
  },
  1: {
    paper: 'bg-emerald-200 border-emerald-300',
    dusk: 'bg-emerald-900/80 border-emerald-700/70',
  },
  2: {
    paper: 'bg-emerald-400 border-emerald-500',
    dusk: 'bg-emerald-600/85 border-emerald-500/80',
  },
  3: {
    paper: 'bg-emerald-600 border-emerald-700',
    dusk: 'bg-emerald-400 border-emerald-300',
  },
};

const LEGEND_LEVELS: readonly ActivityLevel[] = [0, 1, 2, 3];

export default function PracticeCalendar({
  sessions,
  isDusk,
}: {
  sessions: SessionRow[];
  isDusk: boolean;
}) {
  const p = palette(isDusk);
  const calendar = useMemo(() => buildPracticeCalendar(sessions), [sessions]);

  const todayOutline = isDusk ? 'ring-2 ring-[#F0ECF8]' : 'ring-2 ring-[#2A2623]';
  const flameTone =
    calendar.currentStreak > 0
      ? isDusk
        ? 'text-amber-300'
        : 'text-amber-600'
      : p.muted;

  return (
    <section
      aria-label="Practice activity calendar"
      className={`mt-3 rounded-2xl p-3.5 border space-y-2.5 ${p.panel}`}
    >
      {/* Streak summary */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
        <span className={`inline-flex items-center gap-1.5 font-bold ${p.strong}`}>
          <FlameIcon className={`w-3.5 h-3.5 shrink-0 ${flameTone}`} />
          <span className="tabular-nums">
            Current streak: {calendar.currentStreak} {calendar.currentStreak === 1 ? 'day' : 'days'}
          </span>
        </span>
        <span className={`inline-flex items-center gap-1 font-semibold tabular-nums shrink-0 ${p.muted}`}>
          <TrophyIcon className="w-3 h-3 shrink-0" />
          <span>
            Best: {calendar.bestStreak} {calendar.bestStreak === 1 ? 'day' : 'days'}
          </span>
        </span>
      </div>

      {/* 7 rows (Mon..Sun) x 12 columns activity grid */}
      <div className="flex justify-center">
        <div className="inline-flex flex-col gap-1">
          {/* Month labels */}
          <div className="flex items-end gap-2" aria-hidden="true">
            <div className="w-7 shrink-0" />
            <div className="flex gap-[3px]">
              {calendar.weeks.map((week) => (
                <div key={week.index} className="w-[14px] h-3.5 overflow-visible">
                  {week.monthLabel && (
                    <span className={`block whitespace-nowrap text-[10px] font-semibold leading-none ${p.faint}`}>
                      {week.monthLabel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Weekday labels + cells */}
          <div className="flex gap-2">
            <div className="w-7 shrink-0 flex flex-col gap-[3px]" aria-hidden="true">
              {WEEKDAY_LABELS.map((label, i) => (
                <span
                  key={i}
                  className={`h-[14px] flex items-center justify-end text-[10px] font-semibold leading-none select-none ${p.faint}`}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex gap-[3px]">
              {calendar.weeks.map((week) => (
                <div key={week.index} className="flex flex-col gap-[3px]">
                  {week.days.map((day) =>
                    day.isFuture ? (
                      <div key={day.dateKey} className="w-[14px] h-[14px]" aria-hidden="true" />
                    ) : (
                      <div
                        key={day.dateKey}
                        role="img"
                        aria-label={day.ariaLabel}
                        aria-current={day.isToday ? 'date' : undefined}
                        title={day.ariaLabel}
                        className={`w-[14px] h-[14px] rounded-[3px] border ${
                          isDusk ? CELL_TONE[day.level].dusk : CELL_TONE[day.level].paper
                        } ${day.isToday ? todayOutline : ''}`}
                      />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={`flex items-center justify-between gap-2 text-[10px] font-medium ${p.faint}`}>
        <span>Last 12 weeks</span>
        <div className="flex items-center gap-1" aria-hidden="true">
          <span>Less</span>
          {LEGEND_LEVELS.map((level) => (
            <span
              key={level}
              className={`w-2.5 h-2.5 rounded-[2px] border ${
                isDusk ? CELL_TONE[level].dusk : CELL_TONE[level].paper
              }`}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
}
