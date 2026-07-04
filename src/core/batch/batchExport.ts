import { promises as fs } from "node:fs";
import path from "node:path";
import { makeAtlas, type MakeAtlasResult } from "../makeAtlas.js";
import { describeError } from "../../shared/errors.js";
import { PROJECT_FILE_EXTENSION, normalizeProjectFile } from "../../shared/project.js";

export interface BatchExportOptions {
  cacheOverride?: boolean;
  failFast?: boolean;
}

export interface BatchProjectResult {
  projectPath: string;
  success: boolean;
  result?: MakeAtlasResult;
  error?: string;
}

export interface BatchExportResult {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchProjectResult[];
}

export async function batchExport(targets: string[], options: BatchExportOptions = {}): Promise<BatchExportResult> {
  if (targets.length === 0) {
    throw new Error("At least one project file or directory is required.");
  }

  const projectPaths = await resolveProjectTargets(targets);
  const results: BatchProjectResult[] = [];

  for (const projectPath of projectPaths) {
    try {
      const result = await exportProject(projectPath, options);
      results.push({
        projectPath,
        success: true,
        result
      });
    } catch (error) {
      results.push({
        projectPath,
        success: false,
        error: describeError(error)
      });

      if (options.failFast) {
        break;
      }
    }
  }

  const succeeded = results.filter((result) => result.success).length;
  const failed = results.length - succeeded;

  return {
    total: projectPaths.length,
    succeeded,
    failed,
    results
  };
}

export async function resolveProjectTargets(targets: string[]): Promise<string[]> {
  const found = new Map<string, string>();

  for (const target of targets) {
    const resolved = path.resolve(target);
    const stat = await fs.stat(resolved);

    if (stat.isDirectory()) {
      for (const projectPath of await listProjectFiles(resolved)) {
        found.set(projectPath.toLowerCase(), projectPath);
      }
    } else if (stat.isFile() && resolved.toLowerCase().endsWith(PROJECT_FILE_EXTENSION)) {
      found.set(resolved.toLowerCase(), resolved);
    } else {
      throw new Error(`Batch target is not a project file or directory: ${target}`);
    }
  }

  return [...found.values()].sort((a, b) => a.localeCompare(b));
}

async function exportProject(projectPath: string, options: BatchExportOptions): Promise<MakeAtlasResult> {
  const text = await fs.readFile(projectPath, "utf8");
  const { project } = normalizeProjectFile(JSON.parse(text));
  const projectDir = path.dirname(projectPath);
  const inputDir = resolveProjectRelativePath(projectDir, project.inputDir);
  const outputDir = resolveProjectRelativePath(projectDir, project.outputDir);

  return makeAtlas(inputDir, outputDir, {
    name: project.name,
    maxSize: project.options.maxSize,
    padding: project.options.padding,
    format: "json",
    clean: project.options.clean,
    trim: project.options.trim,
    extrude: project.options.extrude,
    rotate: project.options.rotate,
    algorithm: project.options.algorithm,
    sizeMode: project.options.sizeMode,
    cache: options.cacheOverride ?? project.options.cache,
    spriteMetadata: project.sprites
  });
}

function resolveProjectRelativePath(projectDir: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(projectDir, filePath);
}

async function listProjectFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listProjectFiles(fullPath));
    } else if (entry.isFile() && fullPath.toLowerCase().endsWith(PROJECT_FILE_EXTENSION)) {
      files.push(fullPath);
    }
  }

  return files;
}
