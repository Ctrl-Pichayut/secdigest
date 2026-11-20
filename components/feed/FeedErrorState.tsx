'use client';

import React from 'react';

export interface FeedErrorStateProps {
  error: string;
  isDusk: boolean;
  focusRingClass: string;
  onRetry: () => void;
}

export default function FeedErrorState({
  error,
  isDusk,
  focusRingClass,
  onRetry,
}: FeedErrorStateProps) {
  return (
    <div
      className={`rounded-3xl p-4 text-center my-4 shadow-xs border ${
        isDusk
          ? 'bg-[#3A2528] border-rose-800/60 text-rose-200'
          : 'bg-[#F5E2DE] border-rose-300 text-rose-950'
      }`}
    >
      <p className="text-xs font-semibold mb-2.5">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className={`inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-xs hover:bg-rose-700 transition-colors cursor-pointer ${focusRingClass}`}
      >
        Retry
      </button>
    </div>
  );
}
