import {
  DEFAULT_APP_LANGUAGE,
  type AppLanguage,
  type ResolvedAppLanguage
} from "./types.js";
import { isEnabledAppLanguage } from "./language-registry.js";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return isEnabledAppLanguage(value);
}

export function normalizeAppLanguage(value: unknown): AppLanguage {
  return isAppLanguage(value) ? value : DEFAULT_APP_LANGUAGE;
}

export function resolveAppLanguage(
  language: AppLanguage = DEFAULT_APP_LANGUAGE,
  systemLocale = ""
): ResolvedAppLanguage {
  if (language !== "system" && isEnabledAppLanguage(language)) {
    return language;
  }

  const normalizedLocale = systemLocale.toLowerCase();
  return normalizedLocale === "ko" || normalizedLocale.startsWith("ko-")
    ? "ko"
    : "en";
}

export function isResolvedAppLanguage(value: unknown): value is ResolvedAppLanguage {
  return value !== "system" && isEnabledAppLanguage(value);
}
