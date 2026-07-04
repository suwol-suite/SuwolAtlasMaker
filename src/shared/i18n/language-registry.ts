import type { AppLanguage } from "./types.js";

export interface LanguageOption {
  id: AppLanguage;
  label: string;
  nativeLabel: string;
  enabled: boolean;
}

export const languageOptions: readonly LanguageOption[] = [
  { id: "system", label: "System", nativeLabel: "System", enabled: true },
  { id: "en", label: "English", nativeLabel: "English", enabled: true },
  { id: "ko", label: "Korean", nativeLabel: "\uD55C\uAD6D\uC5B4", enabled: true }
];

export function getEnabledLanguageOptions(): LanguageOption[] {
  return languageOptions.filter((option) => option.enabled);
}

export function getEnabledLocaleIds(): string[] {
  return getEnabledLanguageOptions()
    .map((option) => option.id)
    .filter((id) => id !== "system");
}

export function isRegisteredAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && languageOptions.some((option) => option.id === value);
}

export function isEnabledAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && languageOptions.some((option) => option.id === value && option.enabled);
}
