import type { SuwolAtlasGuiApi } from "../shared/gui-types";

declare global {
  interface Window {
    suwolAtlas: SuwolAtlasGuiApi;
  }
}

export {};
