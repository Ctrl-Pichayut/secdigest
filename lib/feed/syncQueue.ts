import { type NewsItem } from '@/lib/types';

export const PENDING_PATCHES_STORAGE_KEY = 'secdigest.pendingPatches.v1';
export const MAX_PENDING_PATCHES = 500;

export type PendingPatch = {
  id: string;
  is_read?: boolean;
  is_bookmarked?: boolean;
  queuedAt: number;
};

export type PendingPatchFields = Pick<PendingPatch, 'is_read' | 'is_bookmarked'>;

export interface PendingPatchBatch {
  ids: string[];
  fields: PendingPatchFields;
}

const NETWORK_FAILURE_PATTERN =
  /failed to fetch|networkerror|network request failed|load failed|fetch failed/i;

function getStorage(): Storage | null {
  try {
    if (
      typeof globalThis !== 'undefined' &&
      'localStorage' in globalThis &&
      globalThis.localStorage
    ) {
      return globalThis.localStorage;
    }
  } catch {
    // Accessing localStorage can throw in restricted or private browsing contexts.
  }
  return null;
}

function capQueue(
  queue: readonly PendingPatch[],
  maxEntries: number = MAX_PENDING_PATCHES
): PendingPatch[] {
  if (queue.length <= maxEntries) {
    return [...queue];
  }

  // Drop entries with the oldest queuedAt (breaking ties by earlier array position).
  const indexed = queue.map((entry, index) => ({ entry, index }));
  indexed.sort(
    (a, b) => a.entry.queuedAt - b.entry.queuedAt || a.index - b.index
  );
  const droppedIndices = new Set(
    indexed.slice(0, queue.length - maxEntries).map((item) => item.index)
  );
  return queue.filter((_, index) => !droppedIndices.has(index));
}

function sanitizePendingPatch(value: unknown): PendingPatch | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.trim().length === 0) {
    return null;
  }
  if (
    typeof record.queuedAt !== 'number' ||
    !Number.isFinite(record.queuedAt)
  ) {
    return null;
  }

  const hasRead = record.is_read !== undefined;
  const hasBookmarked = record.is_bookmarked !== undefined;
  if (hasRead && typeof record.is_read !== 'boolean') {
    return null;
  }
  if (hasBookmarked && typeof record.is_bookmarked !== 'boolean') {
    return null;
  }
  if (!hasRead && !hasBookmarked) {
    return null;
  }

  const sanitized: PendingPatch = {
    id: record.id,
    queuedAt: record.queuedAt,
  };
  if (typeof record.is_read === 'boolean') {
    sanitized.is_read = record.is_read;
  }
  if (typeof record.is_bookmarked === 'boolean') {
    sanitized.is_bookmarked = record.is_bookmarked;
  }
  return sanitized;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || '';
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

export function loadQueue(): PendingPatch[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(PENDING_PATCHES_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    let queue: PendingPatch[] = [];
    for (const candidate of parsed) {
      const entry = sanitizePendingPatch(candidate);
      if (!entry) continue;
      const fields: PendingPatchFields = {};
      if (typeof entry.is_read === 'boolean') fields.is_read = entry.is_read;
      if (typeof entry.is_bookmarked === 'boolean') {
        fields.is_bookmarked = entry.is_bookmarked;
      }
      queue = enqueuePatch(queue, entry.id, fields, entry.queuedAt);
    }

    return capQueue(queue);
  } catch {
    return [];
  }
}

export function saveQueue(queue: readonly PendingPatch[]): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const capped = capQueue(queue);
    if (capped.length === 0) {
      storage.removeItem(PENDING_PATCHES_STORAGE_KEY);
    } else {
      storage.setItem(PENDING_PATCHES_STORAGE_KEY, JSON.stringify(capped));
    }
  } catch {
    // Ignore storage errors (private mode, quota exceeded).
  }
}

export function enqueuePatch(
  queue: readonly PendingPatch[],
  id: string,
  fields: PendingPatchFields,
  now: number = Date.now()
): PendingPatch[] {
  const cleanFields: PendingPatchFields = {};
  if (typeof fields.is_read === 'boolean') {
    cleanFields.is_read = fields.is_read;
  }
  if (typeof fields.is_bookmarked === 'boolean') {
    cleanFields.is_bookmarked = fields.is_bookmarked;
  }

  if (
    !id ||
    (cleanFields.is_read === undefined &&
      cleanFields.is_bookmarked === undefined)
  ) {
    return capQueue(queue);
  }

  const existingIndex = queue.findIndex((entry) => entry.id === id);
  let next: PendingPatch[];

  if (existingIndex >= 0) {
    const existing = queue[existingIndex];
    const merged: PendingPatch = {
      ...existing,
      ...cleanFields,
      id,
      queuedAt: now,
    };
    next = [
      ...queue.slice(0, existingIndex),
      ...queue.slice(existingIndex + 1),
      merged,
    ];
  } else {
    next = [
      ...queue,
      {
        id,
        ...cleanFields,
        queuedAt: now,
      },
    ];
  }

  return capQueue(next);
}

export function applyPendingPatches<
  T extends Pick<NewsItem, 'id' | 'is_read' | 'is_bookmarked'>
>(items: readonly T[], queue: readonly PendingPatch[]): T[] {
  if (queue.length === 0 || items.length === 0) {
    return [...items];
  }

  const patchById = new Map<string, PendingPatch>();
  for (const patch of queue) {
    patchById.set(patch.id, patch);
  }

  return items.map((item) => {
    const patch = patchById.get(item.id);
    if (!patch) return item;

    const nextRead =
      typeof patch.is_read === 'boolean' ? patch.is_read : item.is_read;
    const nextBookmarked =
      typeof patch.is_bookmarked === 'boolean'
        ? patch.is_bookmarked
        : item.is_bookmarked;

    if (nextRead === item.is_read && nextBookmarked === item.is_bookmarked) {
      return item;
    }

    return {
      ...item,
      is_read: nextRead,
      is_bookmarked: nextBookmarked,
    };
  });
}

export function isNetworkFailure(
  error: unknown,
  navigatorOnline: boolean = typeof navigator !== 'undefined'
    ? navigator.onLine
    : true
): boolean {
  if (navigatorOnline === false) {
    return true;
  }
  const message = extractErrorMessage(error);
  return NETWORK_FAILURE_PATTERN.test(message);
}

export function groupPendingPatches(
  queue: readonly PendingPatch[]
): PendingPatchBatch[] {
  const groups = new Map<string, PendingPatchBatch>();

  for (const entry of queue) {
    const fields: PendingPatchFields = {};
    if (typeof entry.is_read === 'boolean') fields.is_read = entry.is_read;
    if (typeof entry.is_bookmarked === 'boolean') {
      fields.is_bookmarked = entry.is_bookmarked;
    }
    if (fields.is_read === undefined && fields.is_bookmarked === undefined) {
      continue;
    }

    const key = `r:${fields.is_read === undefined ? '_' : fields.is_read}|b:${
      fields.is_bookmarked === undefined ? '_' : fields.is_bookmarked
    }`;
    const existing = groups.get(key);
    if (existing) {
      existing.ids.push(entry.id);
    } else {
      groups.set(key, { ids: [entry.id], fields });
    }
  }

  return Array.from(groups.values());
}

/**
 * Removes queued fields covered by a successful direct write so stale queued
 * values can never overwrite a newer server value during a later flush.
 */
export function clearQueuedFields(
  queue: readonly PendingPatch[],
  ids: readonly string[],
  coveredFields: PendingPatchFields,
  maxQueuedAt?: number
): PendingPatch[] {
  if (queue.length === 0 || ids.length === 0) return [...queue];

  const clearRead = typeof coveredFields.is_read === 'boolean';
  const clearBookmarked = typeof coveredFields.is_bookmarked === 'boolean';
  if (!clearRead && !clearBookmarked) return [...queue];

  const idSet = new Set(ids);
  const next: PendingPatch[] = [];

  for (const entry of queue) {
    if (!idSet.has(entry.id)) {
      next.push(entry);
      continue;
    }
    if (maxQueuedAt !== undefined && entry.queuedAt > maxQueuedAt) {
      next.push(entry);
      continue;
    }

    const keepRead = !clearRead && typeof entry.is_read === 'boolean';
    const keepBookmarked =
      !clearBookmarked && typeof entry.is_bookmarked === 'boolean';

    if (
      keepRead === (typeof entry.is_read === 'boolean') &&
      keepBookmarked === (typeof entry.is_bookmarked === 'boolean')
    ) {
      next.push(entry);
      continue;
    }

    if (!keepRead && !keepBookmarked) {
      continue;
    }

    const remaining: PendingPatch = {
      id: entry.id,
      queuedAt: entry.queuedAt,
    };
    if (keepRead) remaining.is_read = entry.is_read;
    if (keepBookmarked) remaining.is_bookmarked = entry.is_bookmarked;
    next.push(remaining);
  }

  return next;
}

/**
 * Removes only fields whose current queued values match the flushed batch,
 * preserving any newer offline edits made while the flush request was in flight.
 */
export function removeMatchingPatchFields(
  queue: readonly PendingPatch[],
  ids: readonly string[],
  flushedFields: PendingPatchFields
): PendingPatch[] {
  if (queue.length === 0 || ids.length === 0) return [...queue];

  const idSet = new Set(ids);
  const next: PendingPatch[] = [];

  for (const entry of queue) {
    if (!idSet.has(entry.id)) {
      next.push(entry);
      continue;
    }

    const keepRead =
      typeof entry.is_read === 'boolean' &&
      (flushedFields.is_read === undefined ||
        entry.is_read !== flushedFields.is_read);
    const keepBookmarked =
      typeof entry.is_bookmarked === 'boolean' &&
      (flushedFields.is_bookmarked === undefined ||
        entry.is_bookmarked !== flushedFields.is_bookmarked);

    if (
      keepRead === (typeof entry.is_read === 'boolean') &&
      keepBookmarked === (typeof entry.is_bookmarked === 'boolean')
    ) {
      next.push(entry);
      continue;
    }

    if (!keepRead && !keepBookmarked) {
      continue;
    }

    const remaining: PendingPatch = {
      id: entry.id,
      queuedAt: entry.queuedAt,
    };
    if (keepRead) remaining.is_read = entry.is_read;
    if (keepBookmarked) remaining.is_bookmarked = entry.is_bookmarked;
    next.push(remaining);
  }

  return next;
}
