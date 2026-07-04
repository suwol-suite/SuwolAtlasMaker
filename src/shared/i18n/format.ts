import { resolveAppLanguage } from "./language.js";
import type { AppLanguage } from "./types.js";

export function formatDateTime(value: Date | string | number, language: AppLanguage, systemLocale = ""): string {
  const locale = resolveAppLanguage(language, systemLocale);
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function formatNumber(value: number, language: AppLanguage, systemLocale = ""): string {
  const locale = resolveAppLanguage(language, systemLocale);
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercent(value: number, language: AppLanguage, systemLocale = ""): string {
  const locale = resolveAppLanguage(language, systemLocale);
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatFileSize(bytes: number, language: AppLanguage, systemLocale = ""): string {
  const locale = resolveAppLanguage(language, systemLocale);
  const safeBytes = Number.isFinite(bytes) && bytes >= 0 ? bytes : 0;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "byte",
    notation: safeBytes >= 1024 * 1024 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(safeBytes);
}
