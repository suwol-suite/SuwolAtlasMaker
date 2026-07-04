import { I18N_NAMESPACES, type I18nNamespace } from "./types.js";

export function getLocaleNamespaceFileNames(): string[] {
  return I18N_NAMESPACES.map((namespace) => `${namespace}.json`);
}

export function getLocaleNamespaceFromFile(fileName: string): I18nNamespace | null {
  const namespace = fileName.replace(/\.json$/i, "");
  return I18N_NAMESPACES.includes(namespace as I18nNamespace)
    ? namespace as I18nNamespace
    : null;
}

export function hasCompleteLocaleNamespaceSet(fileNames: string[]): boolean {
  const names = new Set(fileNames.filter((fileName) => fileName.endsWith(".json")));
  return getLocaleNamespaceFileNames().every((fileName) => names.has(fileName));
}
