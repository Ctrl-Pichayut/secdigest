'use client';

import React from 'react';
import { SpinnerIcon } from '@/components/icons';

export interface LoadOlderFooterProps {
  isDusk: boolean;
  focusRingClass: string;
  olderError: string | null;
  noOlderItems: boolean;
  loadingOlder: boolean;
  refreshing: boolean;
  onLoadOlder: () => void;
}

export default function LoadOlderFooter({
  isDusk,
  focusRingClass,
  olderError,
  noOlderItems,
  loadingOlder,
  refreshing,
  onLoadOlder,
}: LoadOlderFooterProps) {
  return (
    <div className="pt-3 pb-1 flex flex-col items-center gap-2">
      {olderError && (
        <p
          role="alert"
          data-testid="load-older-error"
          className={`text-xs font-medium text-center px-2 break-words max-w-full ${
            isDusk ? 'text-rose-300' : 'text-rose-800'
          }`}
        >
          {olderError}
        </p>
      )}
      {noOlderItems ? (
        <p
          role="status"
          data-testid="no-older-items"
          className={`text-xs font-medium py-2 ${
            isDusk ? 'text-[#B3ACC5]' : 'text-[#6A635C]'
          }`}
        >
          No older items
        </p>
      ) : (
        <button
          type="button"
          data-testid="load-older"
          aria-label={loadingOlder ? 'Loading older items' : 'Load older items'}
          aria-busy={loadingOlder}
          disabled={loadingOlder || refreshing}
          onClick={onLoadOlder}
          className={`inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-2xl border text-xs font-semibold transition-colors touch-manipulation cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${focusRingClass} ${
            isDusk
              ? 'bg-[#2A263A]/80 hover:bg-[#353048] border-[#3E3852] text-[#D8D2E7]'
              : 'bg-[#EDE8DF]/80 hover:bg-[#E2DBD0] border-[#D2C9B8] text-[#4A443E]'
          }`}
        >
          {loadingOlder ? (
            <>
              <SpinnerIcon className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Loading older...</span>
            </>
          ) : (
            <span>Load older</span>
          )}
        </button>
      )}
    </div>
  );
}
