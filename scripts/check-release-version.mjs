import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const version = manifest.version;
const expectedRef = `refs/tags/v${version}`;
const expectedTag = `v${version}`;
const releaseTag = process.env.RELEASE_TAG;
const githubRef = process.env.GITHUB_REF;
const githubRefType = process.env.GITHUB_REF_TYPE;
const githubRefName = process.env.GITHUB_REF_NAME;

if (!version || typeof version !== "string") {
  fail("package.json version is missing.");
}

if (releaseTag) {
  if (releaseTag !== expectedTag) {
    fail(`Release tag mismatch. package.json version is ${version}, but RELEASE_TAG is ${releaseTag}. Expected ${expectedTag}.`);
  }

  console.log(`Release version check passed: ${releaseTag}`);
  process.exit(0);
}

if (!githubRef) {
  console.warn(`GITHUB_REF is not set. Expected release tag for this package version: ${expectedTag}.`);
  process.exit(0);
}

if (githubRefType && githubRefType !== "tag") {
  console.warn(`Workflow is not running on a tag ref (${githubRef}). Expected tag for release: v${version}.`);
  process.exit(0);
}

if (githubRef !== expectedRef) {
  fail(`Release tag mismatch. package.json version is ${version}, but GITHUB_REF is ${githubRef}. Expected ${expectedRef}.`);
}

if (githubRefName && githubRefName !== expectedTag) {
  fail(`Release tag name mismatch. package.json version is ${version}, but GITHUB_REF_NAME is ${githubRefName}.`);
}

console.log(`Release version check passed: ${githubRef}`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
