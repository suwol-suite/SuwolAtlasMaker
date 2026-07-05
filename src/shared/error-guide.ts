import type { GuiFriendlyErrorCode } from "./gui-utils.js";

export interface ErrorGuideDefinition {
  code: GuiFriendlyErrorCode;
  messageKey: string;
  actionKeys: string[];
}

const ERROR_GUIDES: Record<GuiFriendlyErrorCode, ErrorGuideDefinition> = {
  inputRequired: {
    code: "inputRequired",
    messageKey: "errors:friendly.inputRequired",
    actionKeys: ["errors:guide.inputRequired.selectFolder"]
  },
  outputRequired: {
    code: "outputRequired",
    messageKey: "errors:friendly.outputRequired",
    actionKeys: ["errors:guide.outputRequired.selectFolder"]
  },
  nameRequired: {
    code: "nameRequired",
    messageKey: "errors:friendly.nameRequired",
    actionKeys: ["errors:guide.nameRequired.enterName"]
  },
  noPngFiles: {
    code: "noPngFiles",
    messageKey: "errors:friendly.noPngFiles",
    actionKeys: ["errors:guide.noPngFiles.addPng"]
  },
  duplicateSpriteName: {
    code: "duplicateSpriteName",
    messageKey: "errors:friendly.duplicateSpriteName",
    actionKeys: ["errors:guide.duplicateSpriteName.rename"]
  },
  maxSizeExceeded: {
    code: "maxSizeExceeded",
    messageKey: "errors:friendly.maxSizeExceeded",
    actionKeys: ["errors:guide.maxSizeExceeded.resize"]
  },
  cropInvalid: {
    code: "cropInvalid",
    messageKey: "errors:friendly.cropInvalid",
    actionKeys: ["errors:guide.cropInvalid.adjust"]
  },
  outputFolderMissing: {
    code: "outputFolderMissing",
    messageKey: "errors:friendly.outputFolderMissing",
    actionKeys: ["errors:guide.outputFolderMissing.checkFolder", "errors:guide.outputFolderMissing.permission"]
  },
  sampleMissing: {
    code: "sampleMissing",
    messageKey: "errors:friendly.sampleMissing",
    actionKeys: ["errors:guide.sampleMissing.openCheckout"]
  },
  fallback: {
    code: "fallback",
    messageKey: "errors:fallback",
    actionKeys: ["errors:guide.fallback.details"]
  }
};

export function getErrorGuide(code: GuiFriendlyErrorCode): ErrorGuideDefinition {
  return ERROR_GUIDES[code] ?? ERROR_GUIDES.fallback;
}

export function getErrorGuideCodes(): GuiFriendlyErrorCode[] {
  return Object.keys(ERROR_GUIDES) as GuiFriendlyErrorCode[];
}
