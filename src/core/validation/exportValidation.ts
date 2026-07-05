import { promises as fs } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import type { AtlasJson, AtlasJsonSprite } from "../exporters/jsonExporter.js";

export type ExportValidationStatus = "passed" | "warning" | "error";
export type ExportValidationIssueSeverity = "warning" | "error";

export interface ExportValidationIssue {
  code: string;
  severity: ExportValidationIssueSeverity;
  message: string;
}

export interface ExportValidationCheck {
  code: string;
  passed: boolean;
}

export interface ExportValidationRequest {
  outputDir: string;
  jsonPath: string;
  pngPaths: string[];
  metadataPath?: string;
  atlasJson: AtlasJson;
}

export interface ExportValidationResult {
  status: ExportValidationStatus;
  checks: ExportValidationCheck[];
  issues: ExportValidationIssue[];
}

const REQUIRED_SPRITE_FIELDS = [
  "name",
  "page",
  "x",
  "y",
  "w",
  "h",
  "rotated",
  "trimmed",
  "sourceW",
  "sourceH",
  "offsetX",
  "offsetY",
  "pivotX",
  "pivotY"
] as const;

export async function validateExportResult(request: ExportValidationRequest): Promise<ExportValidationResult> {
  const checks: ExportValidationCheck[] = [];
  const issues: ExportValidationIssue[] = [];

  await checkFileExists(request.jsonPath, "atlasJsonExists", checks, issues);

  const pageDimensions = new Map<number, { width: number; height: number }>();

  for (let index = 0; index < request.atlasJson.pages.length; index += 1) {
    const page = request.atlasJson.pages[index];
    const pagePath = path.join(request.outputDir, page.image);
    const pngInfo = await readPngInfo(pagePath);

    if (!pngInfo) {
      checks.push({ code: "pagePngExists", passed: false });
      issues.push({
        code: "pagePngMissing",
        severity: "error",
        message: `Page PNG is missing: ${page.image}`
      });
      continue;
    }

    checks.push({ code: "pagePngExists", passed: true });
    pageDimensions.set(index, pngInfo);

    if (pngInfo.width === page.width && pngInfo.height === page.height) {
      checks.push({ code: "pageDimensionsMatch", passed: true });
    } else {
      checks.push({ code: "pageDimensionsMatch", passed: false });
      issues.push({
        code: "pageDimensionsMismatch",
        severity: "error",
        message: `Page dimensions do not match PNG size: ${page.image}`
      });
    }
  }

  validateSpriteNames(request.atlasJson.sprites, checks, issues);
  validateSpriteBounds(request.atlasJson.sprites, pageDimensions, checks, issues);
  validateLoaderFields(request.atlasJson, checks, issues);
  await validateMetadataSidecar(request.metadataPath, request.atlasJson.sprites, checks, issues);

  return {
    status: issues.some((issue) => issue.severity === "error")
      ? "error"
      : issues.length > 0
        ? "warning"
        : "passed",
    checks,
    issues
  };
}

async function checkFileExists(
  filePath: string,
  code: string,
  checks: ExportValidationCheck[],
  issues: ExportValidationIssue[]
): Promise<void> {
  try {
    const stat = await fs.stat(filePath);
    const passed = stat.isFile();
    checks.push({ code, passed });

    if (!passed) {
      issues.push({
        code: "atlasJsonMissing",
        severity: "error",
        message: `Expected file is not a regular file: ${filePath}`
      });
    }
  } catch {
    checks.push({ code, passed: false });
    issues.push({
      code: "atlasJsonMissing",
      severity: "error",
      message: `Atlas JSON is missing: ${filePath}`
    });
  }
}

async function readPngInfo(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const png = PNG.sync.read(await fs.readFile(filePath));
    return {
      width: png.width,
      height: png.height
    };
  } catch {
    return null;
  }
}

function validateSpriteNames(
  sprites: AtlasJsonSprite[],
  checks: ExportValidationCheck[],
  issues: ExportValidationIssue[]
): void {
  const names = new Set<string>();
  let hasDuplicate = false;

  for (const sprite of sprites) {
    if (names.has(sprite.name)) {
      hasDuplicate = true;
      issues.push({
        code: "duplicateSpriteName",
        severity: "error",
        message: `Duplicate sprite name in atlas JSON: ${sprite.name}`
      });
    }

    names.add(sprite.name);
  }

  checks.push({ code: "spriteNamesUnique", passed: !hasDuplicate });
}

function validateSpriteBounds(
  sprites: AtlasJsonSprite[],
  pageDimensions: Map<number, { width: number; height: number }>,
  checks: ExportValidationCheck[],
  issues: ExportValidationIssue[]
): void {
  let passed = true;

  for (const sprite of sprites) {
    const page = pageDimensions.get(sprite.page);

    if (!page || sprite.x < 0 || sprite.y < 0 || sprite.w < 0 || sprite.h < 0 || sprite.x + sprite.w > page.width || sprite.y + sprite.h > page.height) {
      passed = false;
      issues.push({
        code: "spriteRectOutOfBounds",
        severity: "error",
        message: `Sprite rect is outside page bounds: ${sprite.name}`
      });
    }
  }

  checks.push({ code: "spriteRectsInsidePages", passed });
}

function validateLoaderFields(
  atlasJson: AtlasJson,
  checks: ExportValidationCheck[],
  issues: ExportValidationIssue[]
): void {
  const pagesValid = atlasJson.pages.every((page) =>
    typeof page.image === "string" &&
    Number.isInteger(page.width) &&
    Number.isInteger(page.height)
  );
  const spritesValid = atlasJson.sprites.every((sprite) =>
    REQUIRED_SPRITE_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(sprite, field))
  );

  checks.push({ code: "loaderFieldsPresent", passed: pagesValid && spritesValid });

  if (!pagesValid || !spritesValid) {
    issues.push({
      code: "loaderFieldsMissing",
      severity: "error",
      message: "Atlas JSON is missing fields required by the Unity or MonoGame loaders."
    });
  }
}

async function validateMetadataSidecar(
  metadataPath: string | undefined,
  sprites: AtlasJsonSprite[],
  checks: ExportValidationCheck[],
  issues: ExportValidationIssue[]
): Promise<void> {
  if (!metadataPath) {
    checks.push({ code: "metadataSidecarMatches", passed: true });
    return;
  }

  try {
    const sidecar = JSON.parse(await fs.readFile(metadataPath, "utf8")) as { sprites?: Array<{ name?: unknown }> };
    const atlasNames = new Set(sprites.map((sprite) => sprite.name));
    const missing = (sidecar.sprites ?? [])
      .map((sprite) => sprite.name)
      .filter((name): name is string => typeof name === "string" && !atlasNames.has(name));

    checks.push({ code: "metadataSidecarMatches", passed: missing.length === 0 });

    if (missing.length > 0) {
      issues.push({
        code: "metadataSpriteMissing",
        severity: "warning",
        message: `Metadata sidecar references sprite names not found in the atlas: ${missing.join(", ")}`
      });
    }
  } catch {
    checks.push({ code: "metadataSidecarMatches", passed: false });
    issues.push({
      code: "metadataUnreadable",
      severity: "warning",
      message: `Metadata sidecar could not be read: ${metadataPath}`
    });
  }
}
