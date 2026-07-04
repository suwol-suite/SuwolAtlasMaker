import { useTranslation } from "react-i18next";
import type { AppLanguage } from "../../../shared/gui-types";
import { getEnabledLanguageOptions } from "../../../shared/i18n/language-registry";

interface LanguageSelectorProps {
  value: AppLanguage;
  onChange(language: AppLanguage): void;
}

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const { t } = useTranslation("common");
  const options = getEnabledLanguageOptions();

  return (
    <label className="languageSelector">
      <span>{t("labels.language")}</span>
      <select
        value={value}
        aria-label={t("labels.language")}
        onChange={(event) => onChange(event.target.value as AppLanguage)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.id === "system" ? t("labels.system") : option.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
