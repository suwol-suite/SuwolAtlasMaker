import path from "node:path";

export function resolveInputRelativePath(inputDir: string, relativePath: string): string {
  if (!inputDir || typeof inputDir !== "string") {
    throw new Error("Input directory is required.");
  }

  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("Sprite relative path is required.");
  }

  if (path.isAbsolute(relativePath) || path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new Error("Sprite path must be relative to the input directory.");
  }

  const normalizedRelative = relativePath.replace(/\\/g, "/");

  if (normalizedRelative.includes("\0")) {
    throw new Error("Sprite path must not contain null bytes.");
  }

  if (normalizedRelative.split("/").some((part) => part === "..")) {
    throw new Error("Sprite path must stay inside the input directory.");
  }

  if (!normalizedRelative.toLowerCase().endsWith(".png")) {
    throw new Error("Only PNG sprite previews are supported.");
  }

  const root = path.resolve(inputDir);
  const resolved = path.resolve(root, normalizedRelative);
  const relativeFromRoot = path.relative(root, resolved);

  if (relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
    throw new Error("Sprite path must stay inside the input directory.");
  }

  return resolved;
}
