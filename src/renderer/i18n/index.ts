import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resolveAppLanguage } from "../../shared/i18n/language";
import type { AppLanguage } from "../../shared/i18n/types";

import enBatch from "../../shared/i18n/locales/en/batch.json";
import enCommon from "../../shared/i18n/locales/en/common.json";
import enDiagnostics from "../../shared/i18n/locales/en/diagnostics.json";
import enErrors from "../../shared/i18n/locales/en/errors.json";
import enHelp from "../../shared/i18n/locales/en/help.json";
import enMenu from "../../shared/i18n/locales/en/menu.json";
import enMetadata from "../../shared/i18n/locales/en/metadata.json";
import enOptions from "../../shared/i18n/locales/en/options.json";
import enPreview from "../../shared/i18n/locales/en/preview.json";
import enProject from "../../shared/i18n/locales/en/project.json";
import enSprites from "../../shared/i18n/locales/en/sprites.json";
import enUpdates from "../../shared/i18n/locales/en/updates.json";
import enWatch from "../../shared/i18n/locales/en/watch.json";
import koBatch from "../../shared/i18n/locales/ko/batch.json";
import koCommon from "../../shared/i18n/locales/ko/common.json";
import koDiagnostics from "../../shared/i18n/locales/ko/diagnostics.json";
import koErrors from "../../shared/i18n/locales/ko/errors.json";
import koHelp from "../../shared/i18n/locales/ko/help.json";
import koMenu from "../../shared/i18n/locales/ko/menu.json";
import koMetadata from "../../shared/i18n/locales/ko/metadata.json";
import koOptions from "../../shared/i18n/locales/ko/options.json";
import koPreview from "../../shared/i18n/locales/ko/preview.json";
import koProject from "../../shared/i18n/locales/ko/project.json";
import koSprites from "../../shared/i18n/locales/ko/sprites.json";
import koUpdates from "../../shared/i18n/locales/ko/updates.json";
import koWatch from "../../shared/i18n/locales/ko/watch.json";

export const resources = {
  en: {
    batch: enBatch,
    common: enCommon,
    diagnostics: enDiagnostics,
    errors: enErrors,
    help: enHelp,
    menu: enMenu,
    metadata: enMetadata,
    options: enOptions,
    preview: enPreview,
    project: enProject,
    sprites: enSprites,
    updates: enUpdates,
    watch: enWatch
  },
  ko: {
    batch: koBatch,
    common: koCommon,
    diagnostics: koDiagnostics,
    errors: koErrors,
    help: koHelp,
    menu: koMenu,
    metadata: koMetadata,
    options: koOptions,
    preview: koPreview,
    project: koProject,
    sprites: koSprites,
    updates: koUpdates,
    watch: koWatch
  }
} as const;

export function resolveRendererLanguage(language: AppLanguage): "en" | "ko" {
  const resolved = resolveAppLanguage(language, navigator.language);
  return resolved === "ko" ? "ko" : "en";
}

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: resolveAppLanguage("system", navigator.language),
    fallbackLng: "en",
    defaultNS: "common",
    ns: Object.keys(resources.en),
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
