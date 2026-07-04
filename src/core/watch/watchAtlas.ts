import { watch, type FSWatcher } from "node:fs";
import path from "node:path";
import { isPngFile, isSameOrInside } from "../../shared/paths.js";

export interface DebouncedExportQueueOptions<T> {
  debounceMs: number;
  run: (reason: string) => Promise<T>;
  onStart?: (reason: string) => void;
  onSuccess?: (result: T, reason: string) => void;
  onError?: (error: unknown, reason: string) => void;
  onQueued?: (reason: string) => void;
}

export interface AtlasWatchOptions<T> extends DebouncedExportQueueOptions<T> {
  inputDir: string;
  outputDir: string;
  triggerInitial?: boolean;
  onFileEvent?: (reason: string) => void;
}

export interface AtlasWatcher {
  trigger(reason: string): void;
  close(): void;
  readonly closed: boolean;
}

export class DebouncedExportQueue<T> {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private pendingReason: string | null = null;
  private isClosed = false;

  constructor(private readonly options: DebouncedExportQueueOptions<T>) {}

  get closed(): boolean {
    return this.isClosed;
  }

  trigger(reason: string): void {
    if (this.isClosed) {
      return;
    }

    if (this.running) {
      this.pendingReason = reason;
      this.options.onQueued?.(reason);
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runNow(reason);
    }, this.options.debounceMs);
  }

  async runNow(reason: string): Promise<void> {
    if (this.isClosed || this.running) {
      this.pendingReason = reason;
      return;
    }

    this.running = true;
    this.options.onStart?.(reason);

    try {
      const result = await this.options.run(reason);
      this.options.onSuccess?.(result, reason);
    } catch (error) {
      this.options.onError?.(error, reason);
    } finally {
      this.running = false;

      if (this.pendingReason && !this.isClosed) {
        const pending = this.pendingReason;
        this.pendingReason = null;
        this.trigger(pending);
      }
    }
  }

  close(): void {
    this.isClosed = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export function watchAtlas<T>(options: AtlasWatchOptions<T>): AtlasWatcher {
  const resolvedInputDir = path.resolve(options.inputDir);
  const resolvedOutputDir = path.resolve(options.outputDir);

  if (isSameOrInside(resolvedInputDir, resolvedOutputDir)) {
    throw new Error("Watch mode refused because the output directory is inside the input directory.");
  }

  const queue = new DebouncedExportQueue(options);
  const watcher = watch(resolvedInputDir, { recursive: true }, (_eventType, fileName) => {
    const normalized = typeof fileName === "string" ? fileName : "";

    if (normalized && !isPngFile(normalized)) {
      return;
    }

    const reason = normalized ? `input changed: ${normalized.replace(/\\/g, "/")}` : "input changed";
    options.onFileEvent?.(reason);
    queue.trigger(reason);
  });

  if (options.triggerInitial ?? true) {
    void queue.runNow("initial export");
  }

  return {
    trigger: (reason: string) => queue.trigger(reason),
    close: () => {
      queue.close();
      closeWatcher(watcher);
    },
    get closed() {
      return queue.closed;
    }
  };
}

function closeWatcher(watcher: FSWatcher): void {
  try {
    watcher.close();
  } catch {
    // Closing an already closed watcher is harmless.
  }
}
