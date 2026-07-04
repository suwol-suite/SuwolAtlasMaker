import { verifyReleasePackage } from "./verify-release-zip.mjs";

const result = await verifyReleasePackage("win", { requireArchive: false });

console.log(`Windows packaged smoke passed: ${result.sourceDir}`);
