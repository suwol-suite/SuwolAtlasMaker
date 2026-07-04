import path from "node:path";

export function withoutExtension(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

export function isPngFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".png";
}

export function isSameOrInside(parentPath: string, childPath: string): boolean {
  const parent = path.resolve(parentPath);
  const child = path.resolve(childPath);
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertSafeOutputName(name: string): void {
  if (name.trim().length === 0) {
    throw new Error("Atlas name must not be empty.");
  }

  if (name.includes("/") || name.includes("\\") || name.includes(path.sep)) {
    throw new Error("Atlas name must be a file name, not a path.");
  }
}
