import type { ExportValidationResult } from "../core/validation/exportValidation.js";

export type ExportValidationTone = "passed" | "warning" | "error";

export interface ExportValidationDisplay {
  tone: ExportValidationTone;
  titleKey: string;
  messageKey: string;
  issueKeys: string[];
}

export function buildExportValidationDisplay(validation: ExportValidationResult): ExportValidationDisplay {
  const tone = validation.status;

  return {
    tone,
    titleKey: `diagnostics:validation.${tone}.title`,
    messageKey: `diagnostics:validation.${tone}.message`,
    issueKeys: validation.issues.map((issue) => `diagnostics:validation.issues.${issue.code}`)
  };
}

export function formatExportValidationLog(validation: ExportValidationResult): string {
  const header = `Export validation: ${validation.status}`;
  const checks = validation.checks.map((check) => `- ${check.passed ? "OK" : "FAIL"} ${check.code}`);
  const issues = validation.issues.map((issue) => `- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);

  return [header, ...checks, ...issues].join("\n");
}
