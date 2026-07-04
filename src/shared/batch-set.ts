export const BATCH_SET_FILE_VERSION = 1;
export const BATCH_SET_FILE_EXTENSION = ".suwol-atlas-batch.json";

export interface GuiBatchSetSchedule {
  enabled: boolean;
  mode: "manual";
  note?: string;
}

export interface GuiBatchSetOptions {
  failFast: boolean;
}

export interface GuiBatchSet {
  version: typeof BATCH_SET_FILE_VERSION;
  name: string;
  projects: string[];
  options: GuiBatchSetOptions;
  schedule: GuiBatchSetSchedule;
}

export interface GuiBatchSetLoadResult {
  path: string;
  batchSet: GuiBatchSet;
  warnings: string[];
}

export interface GuiBatchSetSaveRequest {
  path?: string | null;
  batchSet: GuiBatchSet;
}

export interface GuiBatchSetSaveResult {
  path: string;
  batchSet: GuiBatchSet;
}

export interface GuiBatchSetRunRequest {
  path?: string | null;
  batchSet: GuiBatchSet;
}

export function createBatchSet(
  name: string,
  projects: string[],
  options: Partial<GuiBatchSetOptions & { schedule: Partial<GuiBatchSetSchedule> }> = {}
): GuiBatchSet {
  return {
    version: BATCH_SET_FILE_VERSION,
    name: normalizeBatchSetName(name),
    projects: normalizeProjectPaths(projects),
    options: {
      failFast: Boolean(options.failFast)
    },
    schedule: normalizeSchedule(options.schedule)
  };
}

export function normalizeBatchSet(value: unknown): { batchSet: GuiBatchSet; warnings: string[] } {
  const warnings: string[] = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    warnings.push("Batch set was empty or invalid. Defaults were used.");
    return {
      batchSet: createBatchSet("Batch Set", []),
      warnings
    };
  }

  const partial = value as Partial<GuiBatchSet>;

  if (partial.version !== BATCH_SET_FILE_VERSION) {
    warnings.push(`Unsupported batch set version "${String(partial.version)}"; version 1 defaults were used where needed.`);
  }

  return {
    batchSet: {
      version: BATCH_SET_FILE_VERSION,
      name: normalizeBatchSetName(partial.name),
      projects: normalizeProjectPaths(partial.projects),
      options: {
        failFast: Boolean(partial.options?.failFast)
      },
      schedule: normalizeSchedule(partial.schedule)
    },
    warnings
  };
}

export function ensureBatchSetExtension(filePath: string): string {
  return filePath.endsWith(BATCH_SET_FILE_EXTENSION)
    ? filePath
    : `${filePath}${BATCH_SET_FILE_EXTENSION}`;
}

function normalizeBatchSetName(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "Batch Set";
}

function normalizeProjectPaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const projects: string[] = [];

  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      continue;
    }

    const normalized = item.replace(/\\/g, "/");
    const key = normalized.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    projects.push(normalized);
  }

  return projects;
}

function normalizeSchedule(value: unknown): GuiBatchSetSchedule {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      enabled: false,
      mode: "manual"
    };
  }

  const partial = value as Partial<GuiBatchSetSchedule>;
  const note = typeof partial.note === "string" && partial.note.trim().length > 0
    ? partial.note.trim()
    : undefined;

  return {
    enabled: Boolean(partial.enabled),
    mode: "manual",
    ...(note ? { note } : {})
  };
}
