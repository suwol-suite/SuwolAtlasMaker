export interface EditorHistory<T> {
  past: T[];
  present: T;
  future: T[];
  baselineKey: string;
  limit: number;
}

export const DEFAULT_HISTORY_LIMIT = 100;

export function createEditorHistory<T>(
  initial: T,
  options: { limit?: number; baselineKey?: string; serialize?: (value: T) => string } = {}
): EditorHistory<T> {
  const serialize = options.serialize ?? defaultSerialize;

  return {
    past: [],
    present: initial,
    future: [],
    baselineKey: options.baselineKey ?? serialize(initial),
    limit: normalizeLimit(options.limit)
  };
}

export function resetEditorHistory<T>(
  current: EditorHistory<T>,
  present: T,
  options: { baselineKey?: string; serialize?: (value: T) => string } = {}
): EditorHistory<T> {
  const serialize = options.serialize ?? defaultSerialize;

  return {
    past: [],
    present,
    future: [],
    baselineKey: options.baselineKey ?? serialize(present),
    limit: current.limit
  };
}

export function pushEditorHistory<T>(
  history: EditorHistory<T>,
  next: T,
  serialize: (value: T) => string = defaultSerialize
): EditorHistory<T> {
  if (serialize(history.present) === serialize(next)) {
    return history;
  }

  const past = [...history.past, history.present].slice(-history.limit);

  return {
    ...history,
    past,
    present: next,
    future: []
  };
}

export function replaceEditorHistoryPresent<T>(history: EditorHistory<T>, present: T): EditorHistory<T> {
  return {
    ...history,
    present
  };
}

export function pushEditorHistoryFrom<T>(
  history: EditorHistory<T>,
  basePresent: T,
  next: T,
  serialize: (value: T) => string = defaultSerialize
): EditorHistory<T> {
  if (serialize(basePresent) === serialize(next)) {
    return replaceEditorHistoryPresent(history, next);
  }

  const past = [...history.past, basePresent].slice(-history.limit);

  return {
    ...history,
    past,
    present: next,
    future: []
  };
}

export function undoEditorHistory<T>(history: EditorHistory<T>): EditorHistory<T> {
  if (history.past.length === 0) {
    return history;
  }

  const present = history.past[history.past.length - 1];
  const past = history.past.slice(0, -1);

  return {
    ...history,
    past,
    present,
    future: [history.present, ...history.future]
  };
}

export function redoEditorHistory<T>(history: EditorHistory<T>): EditorHistory<T> {
  if (history.future.length === 0) {
    return history;
  }

  const [present, ...future] = history.future;
  const past = [...history.past, history.present].slice(-history.limit);

  return {
    ...history,
    past,
    present,
    future
  };
}

export function markEditorHistorySaved<T>(
  history: EditorHistory<T>,
  serialize: (value: T) => string = defaultSerialize
): EditorHistory<T> {
  return {
    ...history,
    baselineKey: serialize(history.present)
  };
}

export function isEditorHistoryDirty<T>(
  history: EditorHistory<T>,
  serialize: (value: T) => string = defaultSerialize
): boolean {
  return serialize(history.present) !== history.baselineKey;
}

export function canUndoEditorHistory<T>(history: EditorHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedoEditorHistory<T>(history: EditorHistory<T>): boolean {
  return history.future.length > 0;
}

function normalizeLimit(value: unknown): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : DEFAULT_HISTORY_LIMIT;
}

function defaultSerialize<T>(value: T): string {
  return JSON.stringify(value);
}
