export interface SuwolAtlasErrorOptions {
  code?: string;
  filePath?: string;
  cause?: unknown;
}

export class SuwolAtlasError extends Error {
  readonly code?: string;
  readonly filePath?: string;

  constructor(message: string, options: SuwolAtlasErrorOptions = {}) {
    super(message);
    this.name = "SuwolAtlasError";
    this.code = options.code;
    this.filePath = options.filePath;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function describeError(error: unknown): string {
  if (error instanceof SuwolAtlasError) {
    const fileLine = error.filePath ? `\nFile: ${error.filePath}` : "";
    return `${error.message}${fileLine}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
