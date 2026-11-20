'use client';

import { useCallback, useEffect, useState } from 'react';

export type TextSize = 'sm' | 'md' | 'lg';

export const TEXT_SIZE_STORAGE_KEY = 'secdigest.textSize.v1';
export const DEFAULT_TEXT_SIZE: TextSize = 'sm';

const TEXT_SIZE_ORDER: readonly TextSize[] = ['sm', 'md', 'lg'];

type Subscriber = (size: TextSize) => void;

const subscribers = new Set<Subscriber>();
let currentSize: TextSize = DEFAULT_TEXT_SIZE;

export function parseTextSize(value: unknown): TextSize {
  if (value === 'sm' || value === 'md' || value === 'lg') {
    return value;
  }
  return DEFAULT_TEXT_SIZE;
}

export function getNextTextSize(size: TextSize): TextSize {
  const index = TEXT_SIZE_ORDER.indexOf(size);
  if (index < 0) return 'md';
  return TEXT_SIZE_ORDER[(index + 1) % TEXT_SIZE_ORDER.length];
}

function tryReadStoredTextSize(): TextSize | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
    return parseTextSize(raw);
  } catch {
    return null;
  }
}

function writeStoredTextSize(size: TextSize): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size);
  } catch {
    // Ignore storage errors (private mode, quota exceeded).
  }
}

function notifySubscribers(next: TextSize): void {
  currentSize = next;
  for (const listener of subscribers) {
    listener(next);
  }
}

function handleStorageEvent(event: StorageEvent): void {
  try {
    if (event.storageArea && event.storageArea !== window.localStorage) {
      return;
    }
  } catch {
    // Ignore restricted localStorage access.
  }

  if (event.key !== null && event.key !== TEXT_SIZE_STORAGE_KEY) {
    return;
  }

  notifySubscribers(parseTextSize(event.newValue));
}

function subscribe(listener: Subscriber): () => void {
  if (subscribers.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }
  subscribers.add(listener);

  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
}

export interface UseTextSizeResult {
  size: TextSize;
  setSize: (next: TextSize) => void;
  cycle: () => void;
}

export function useTextSize(): UseTextSizeResult {
  // Always start with 'sm' on the server and initial client render to avoid hydration mismatches.
  const [size, setSizeState] = useState<TextSize>(DEFAULT_TEXT_SIZE);

  useEffect(() => {
    const stored = tryReadStoredTextSize();
    if (stored !== null) {
      currentSize = stored;
    }
    setSizeState(currentSize);

    return subscribe((next) => {
      setSizeState(next);
    });
  }, []);

  const setSize = useCallback((next: TextSize) => {
    const valid = parseTextSize(next);
    writeStoredTextSize(valid);
    notifySubscribers(valid);
  }, []);

  const cycle = useCallback(() => {
    const next = getNextTextSize(currentSize);
    writeStoredTextSize(next);
    notifySubscribers(next);
  }, []);

  return { size, setSize, cycle };
}
