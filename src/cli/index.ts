#!/usr/bin/env node
import { Command } from "commander";
import { promises as fs } from "node:fs";
import path from "node:path";
import { batchExport } from "../core/batch/batchExport.js";
import { makeAtlas, type MakeAtlasOptions } from "../core/makeAtlas.js";
import { watchAtlas } from "../core/watch/watchAtlas.js";
import { describeError } from "../shared/errors.js";
import { type PackingAlgorithm } from "../shared/packing.js";
import { normalizeProjectFile } from "../shared/project.js";
import { type SizeMode } from "../shared/sizeMode.js";
import { parseNonNegativeInteger, parsePackingAlgorithmOption, parsePositiveInteger, parseSizeModeOption } from "./options.js";

const program = new Command();

program
  .name("suwol-atlas")
  .description("Suwol Atlas Maker command line tools.")
  .version("0.1.0");

program
  .command("make")
  .description("Build an atlas PNG and JSON from PNG files in a directory.")
  .argument("[inputDir]", "Directory containing PNG files.")
  .argument("[outputDir]", "Directory where atlas files will be written.")
  .option("--project <file>", "Export from a .suwol-atlas.json project file.")
  .option("--name <name>", "Output atlas name.", "atlas")
  .option("--max-size <pixels>", "Maximum atlas width and height.", parsePositiveInteger, 2048)
  .option("--padding <pixels>", "Transparent padding between sprites.", parseNonNegativeInteger, 0)
  .option("--format <format>", "Export metadata format.", "json")
  .option("--trim", "Trim transparent bounds before packing.", false)
  .option("--no-trim", "Disable trim.")
  .option("--extrude <pixels>", "Duplicate sprite edge pixels outward.", parseNonNegativeInteger, 0)
  .option("--rotate", "Allow 90-degree rotated packing.", false)
  .option("--no-rotate", "Disable rotated packing.")
  .option("--algorithm <shelf|maxrects>", "Packing algorithm.", parsePackingAlgorithmOption, "shelf")
  .option("--size-mode <tight|pot|square-pot>", "Atlas page size mode.", parseSizeModeOption, "tight")
  .option("--cache", "Use incremental cache.", false)
  .option("--no-cache", "Disable incremental cache.")
  .option("--watch", "Watch input PNG changes and export automatically.", false)
  .option("--watch-debounce <ms>", "Watch debounce window in milliseconds.", parsePositiveInteger, 750)
  .option("--clean", "Clean the output directory before writing files.", false)
  .option("--metadata", "Force metadata sidecar JSON export.")
  .option("--no-metadata", "Disable metadata sidecar JSON export.")
  .action(async (inputDir: string | undefined, outputDir: string | undefined, options: CliMakeOptions, command: Command) => {
    if (options.watch) {
      await runWatch(inputDir, outputDir, options, command);
      return;
    }

    try {
      const resolved = await resolveCliMakeRequest(inputDir, outputDir, options, command);
      const result = await makeAtlas(resolved.inputDir, resolved.outputDir, resolved.options);
      printMakeResult(result);
    } catch (error) {
      console.error("Suwol Atlas Maker export failed.");
      console.error(describeError(error));
      process.exitCode = 1;
    }
  });

program
  .command("batch")
  .description("Export one or more Suwol Atlas Maker project files.")
  .argument("<projectOrDirectory...>", "Project files or directories containing .suwol-atlas.json files.")
  .option("--cache", "Override projects to enable incremental cache.")
  .option("--no-cache", "Override projects to disable incremental cache.")
  .option("--continue-on-error", "Continue after failed projects.", true)
  .option("--fail-fast", "Stop after the first failed project.", false)
  .action(async (targets: string[], options: CliBatchOptions) => {
    try {
      const result = await batchExport(targets, {
        cacheOverride: options.cache,
        failFast: options.failFast
      });

      console.log("Suwol Atlas Maker batch export complete.");
      console.log(`Projects: ${result.total}`);
      console.log(`Succeeded: ${result.succeeded}`);
      console.log(`Failed: ${result.failed}`);

      for (const item of result.results) {
        if (item.success) {
          console.log(
            `- OK ${item.projectPath}: sprites=${item.result?.spriteCount ?? 0}, excluded=${item.result?.metadata.excludedSprites ?? 0}, renamed=${item.result?.metadata.renamedSprites ?? 0}, manualCrops=${item.result?.metadata.manualCropSprites ?? 0}`
          );
        } else {
          console.log(`- FAIL ${item.projectPath}: ${item.error}`);
        }
      }

      if (result.failed > 0) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error("Suwol Atlas Maker batch export failed.");
      console.error(describeError(error));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error("Suwol Atlas Maker command failed.");
  console.error(describeError(error));
  process.exitCode = 1;
});

async function resolveCliMakeRequest(
  inputDir: string | undefined,
  outputDir: string | undefined,
  options: CliMakeOptions,
  command: Command
): Promise<{ inputDir: string; outputDir: string; options: MakeAtlasOptions }> {
  if (!options.project) {
    if (!inputDir || !outputDir) {
      throw new Error("inputDir and outputDir are required unless --project is used.");
    }

    return {
      inputDir,
      outputDir,
      options: toMakeOptions(options, command)
    };
  }

  const projectPath = path.resolve(options.project);
  const projectDir = path.dirname(projectPath);
  const parsed = JSON.parse(await fs.readFile(projectPath, "utf8"));
  const { project } = normalizeProjectFile(parsed);
  const metadataSource = command.getOptionValueSource("metadata");

  return {
    inputDir: inputDir ?? resolveProjectPath(projectDir, project.inputDir),
    outputDir: outputDir ?? resolveProjectPath(projectDir, project.outputDir),
    options: {
      name: optionWasCli(command, "name") ? options.name : project.name,
      maxSize: optionWasCli(command, "maxSize") ? options.maxSize : project.options.maxSize,
      padding: optionWasCli(command, "padding") ? options.padding : project.options.padding,
      format: optionWasCli(command, "format") ? options.format : "json",
      clean: optionWasCli(command, "clean") ? options.clean : project.options.clean,
      trim: optionWasCli(command, "trim") ? options.trim : project.options.trim,
      extrude: optionWasCli(command, "extrude") ? options.extrude : project.options.extrude,
      rotate: optionWasCli(command, "rotate") ? options.rotate : project.options.rotate,
      algorithm: optionWasCli(command, "algorithm") ? options.algorithm : project.options.algorithm,
      sizeMode: optionWasCli(command, "sizeMode") ? options.sizeMode : project.options.sizeMode,
      cache: optionWasCli(command, "cache") ? options.cache : project.options.cache,
      spriteMetadata: project.sprites,
      metadataSidecar: metadataSource === "cli" ? options.metadata : undefined
    }
  };
}

function toMakeOptions(options: CliMakeOptions, command?: Command): MakeAtlasOptions {
  const metadataSidecar = command?.getOptionValueSource("metadata") === "cli"
    ? options.metadata
    : undefined;

  return {
    name: options.name,
    maxSize: options.maxSize,
    padding: options.padding,
    format: options.format,
    clean: options.clean,
    trim: options.trim,
    extrude: options.extrude,
    rotate: options.rotate,
    algorithm: options.algorithm,
    sizeMode: options.sizeMode,
    cache: options.cache,
    metadataSidecar
  };
}

function printMakeResult(result: Awaited<ReturnType<typeof makeAtlas>>): void {
  console.log("Suwol Atlas Maker export complete.");
  console.log(`Sprites: ${result.spriteCount}`);
  console.log(`Cache: ${result.cache.enabled ? `${result.cache.hits} hit(s), ${result.cache.misses} miss(es)` : "disabled"}`);
  console.log("Generated files:");
  for (const png of result.files.pngs) {
    console.log(`- ${png}`);
  }
  console.log(`- ${result.files.json}`);
  if (result.files.metadata) {
    console.log(`- ${result.files.metadata}`);
  }
  console.log(`- ${result.files.log}`);
  console.log(
    `Metadata: excluded ${result.metadata.excludedSprites}, renamed ${result.metadata.renamedSprites}, pivot overrides ${result.metadata.pivotOverrideSprites}, ordered ${result.metadata.orderedSprites}, manual crops ${result.metadata.manualCropSprites}`
  );

  if (result.warnings.length > 0) {
    console.log("Warnings:");

    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

async function runWatch(inputDir: string | undefined, outputDir: string | undefined, options: CliMakeOptions, command: Command): Promise<void> {
  console.log("Suwol Atlas Maker watch mode started.");
  console.log(`Debounce: ${options.watchDebounce}ms`);
  const resolved = await resolveCliMakeRequest(inputDir, outputDir, options, command);

  const watcher = watchAtlas({
    inputDir: resolved.inputDir,
    outputDir: resolved.outputDir,
    debounceMs: options.watchDebounce,
    run: async (reason) => {
      console.log(`Exporting because ${reason}.`);
      const current = await resolveCliMakeRequest(inputDir, outputDir, options, command);
      return makeAtlas(current.inputDir, current.outputDir, current.options);
    },
    onFileEvent: (reason) => console.log(`Change detected: ${reason}`),
    onQueued: (reason) => console.log(`Export queued: ${reason}`),
    onSuccess: (result) => printMakeResult(result),
    onError: (error) => {
      console.error("Suwol Atlas Maker watch export failed.");
      console.error(describeError(error));
    }
  });

  await waitForShutdown();
  watcher.close();
  console.log("Suwol Atlas Maker watch mode stopped.");
}

function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    const stop = () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolve();
    };

    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
}

interface CliMakeOptions {
  project?: string;
  name: string;
  maxSize: number;
  padding: number;
  format: "json";
  clean: boolean;
  trim: boolean;
  extrude: number;
  rotate: boolean;
  algorithm: PackingAlgorithm;
  sizeMode: SizeMode;
  cache: boolean;
  watch: boolean;
  watchDebounce: number;
  metadata?: boolean;
}

interface CliBatchOptions {
  cache?: boolean;
  continueOnError: boolean;
  failFast: boolean;
}

function optionWasCli(command: Command, name: string): boolean {
  return command.getOptionValueSource(name) === "cli";
}

function resolveProjectPath(projectDir: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(projectDir, filePath);
}
