import { resolveAppLanguage } from "./language.js";
import type { AppLanguage, ResolvedAppLanguage } from "./types.js";

export type MenuLabelKey =
  | "file"
  | "edit"
  | "view"
  | "help"
  | "newProject"
  | "openProject"
  | "saveProject"
  | "saveProjectAs"
  | "openOutputFolder"
  | "batchExport"
  | "undo"
  | "redo"
  | "reload"
  | "toggleDevTools"
  | "about"
  | "aboutTitle"
  | "aboutDetail";

const MENU_LABELS: Record<ResolvedAppLanguage, Record<MenuLabelKey, string>> = {
  en: {
    file: "File",
    edit: "Edit",
    view: "View",
    help: "Help",
    newProject: "New Project",
    openProject: "Open Project",
    saveProject: "Save Project",
    saveProjectAs: "Save Project As",
    openOutputFolder: "Open Output Folder",
    batchExport: "Batch Export",
    undo: "Undo",
    redo: "Redo",
    reload: "Reload",
    toggleDevTools: "Toggle DevTools",
    about: "About",
    aboutTitle: "About Suwol Atlas Maker",
    aboutDetail: "Build game-ready PNG atlases with CLI and desktop GUI workflows."
  },
  ko: {
    file: "파일",
    edit: "편집",
    view: "보기",
    help: "도움말",
    newProject: "새 프로젝트",
    openProject: "프로젝트 열기",
    saveProject: "프로젝트 저장",
    saveProjectAs: "다른 이름으로 프로젝트 저장",
    openOutputFolder: "출력 폴더 열기",
    batchExport: "일괄 내보내기",
    undo: "실행 취소",
    redo: "다시 실행",
    reload: "새로고침",
    toggleDevTools: "개발자 도구 전환",
    about: "정보",
    aboutTitle: "Suwol Atlas Maker 정보",
    aboutDetail: "CLI와 데스크톱 GUI 워크플로로 게임용 PNG 아틀라스를 만듭니다."
  }
};

export function getMenuLabel(key: MenuLabelKey, language: AppLanguage, systemLocale = ""): string {
  return MENU_LABELS[resolveAppLanguage(language, systemLocale)][key] ?? MENU_LABELS.en[key];
}

export function getMenuLabels(language: AppLanguage, systemLocale = ""): Record<MenuLabelKey, string> {
  return MENU_LABELS[resolveAppLanguage(language, systemLocale)];
}
