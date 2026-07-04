export const CACHE_FILE_NAME = ".suwol-atlas-cache.json";
export const CACHE_FILE_VERSION = 1;

export interface AtlasCacheFileEntry {
  path: string;
  size: number;
  mtimeMs: number;
  hash: string;
  width: number;
  height: number;
}

export interface AtlasCacheFile {
  version: 1;
  toolVersion: string;
  inputDir: string;
  optionsHash: string;
  files: AtlasCacheFileEntry[];
}

export interface AtlasCacheStats {
  enabled: boolean;
  cachePath: string;
  hits: number;
  misses: number;
  invalidationReason: string | null;
}
