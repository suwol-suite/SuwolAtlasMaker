export type AppLanguage = "system" | "en" | "ko" | (string & {});
export type ResolvedAppLanguage = "en" | "ko" | (string & {});

export const DEFAULT_APP_LANGUAGE: AppLanguage = "system";

export const SUPPORTED_APP_LANGUAGES: readonly ResolvedAppLanguage[] = ["en", "ko"];

export const I18N_NAMESPACES = [
  "common",
  "menu",
  "project",
  "options",
  "preview",
  "sprites",
  "metadata",
  "batch",
  "watch",
  "errors",
  "diagnostics"
] as const;

export type I18nNamespace = typeof I18N_NAMESPACES[number];
