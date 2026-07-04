import { verifyReleasePackage } from "./verify-release-zip.mjs";

const result = await verifyReleasePackage("linux", { requireArchive: false });

console.log(`Linux packaged smoke passed: ${result.sourceDir}`);
