'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Undo2, X } from 'lucide-react';
import { UNDO_SNACKBAR_DURATION_MS } from '@/lib/feed/constants';
import { type PendingUndo } from '@/lib/feed/useFeed';

export interface UndoSnackbarProps {
  pendingUndo: PendingUndo | null;
  isDusk: boolean;
  focusRingClass?: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function UndoSnackbar({
  pendingUndo,
  isDusk,
  focusRingClass,
  onUndo,
  onDismiss,
}: UndoSnackbarProps) {
  const shouldReduceMotion = useReducedMotion();
  const undoKey = pendingUndo?.key ?? null;

  useEffect(() => {
    if (undoKey === null) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, UNDO_SNACKBAR_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [undoKey, onDismiss]);

  const resolvedFocusRing =
    focusRingClass ??
    (isDusk
      ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E1B29]'
      : 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A2623] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E5DFD3]');

  return (
    <div
      className="fixed inset-x-0 mx-auto w-full max-w-md px-3 z-40 pointer-events-none"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <AnimatePresence>
        {pendingUndo && (
          <motion.div
            key="undo-snackbar"
            data-testid="undo-snackbar"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{
              duration: shouldReduceMotion ? 0.12 : 0.2,
              ease: 'easeOut',
            }}
            className={`pointer-events-auto flex items-center justify-between gap-2 pl-3.5 pr-1.5 py-1 rounded-2xl border backdrop-blur-md shadow-lg transition-colors duration-200 ${
              isDusk
                ? 'bg-[#2A263A]/95 border-[#4A4462] text-[#EAE6F2] shadow-black/30'
                : 'bg-[#EDE8DF]/95 border-[#C4B9A5] text-[#2A2623] shadow-[#2A2623]/10'
            }`}
          >
            <span
              data-testid="undo-snackbar-label"
              className={`min-w-0 flex-1 truncate text-xs font-semibold ${
                isDusk ? 'text-[#D5CEE6]' : 'text-[#5A544E]'
              }`}
            >
              {pendingUndo.label}
            </span>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                data-testid="btn-undo-read"
                onClick={onUndo}
                className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-colors active:scale-95 touch-manipulation cursor-pointer ${resolvedFocusRing} ${
                  isDusk
                    ? 'bg-rose-950/70 text-rose-300 hover:bg-rose-900/80 hover:text-rose-200 border border-rose-700/60'
                    : 'bg-rose-200/80 text-rose-900 hover:bg-rose-200 hover:text-rose-950 border border-rose-300'
                }`}
              >
                <Undo2 aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                <span>Undo</span>
              </button>

              <button
                type="button"
                data-testid="btn-undo-dismiss"
                aria-label="Dismiss"
                onClick={onDismiss}
                className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl transition-colors active:scale-95 touch-manipulation cursor-pointer ${resolvedFocusRing} ${
                  isDusk
                    ? 'text-[#B3ACC5] hover:text-[#EAE6F2] hover:bg-[#353048]'
                    : 'text-[#5A544E] hover:text-[#2A2623] hover:bg-[#E2DBD0]'
                }`}
              >
                <X aria-hidden="true" className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
