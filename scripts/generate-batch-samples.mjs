import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const projectsDir = path.join(root, "samples", "projects");

await fs.mkdir(projectsDir, { recursive: true });

await writeProject("sample-basic.suwol-atlas.json", {
  name: "batch_basic",
  inputDir: "../input",
  outputDir: "../output-batch/basic",
  options: {
    maxSize: 2048,
    padding: 2,
    algorithm: "shelf",
    sizeMode: "tight",
    cache: true,
    watch: false,
    trim: false,
    extrude: 0,
    rotate: false,
    clean: true
  },
  profile: "generic"
});

await writeProject("sample-advanced.suwol-atlas.json", {
  name: "batch_advanced",
  inputDir: "../input-advanced",
  outputDir: "../output-batch/advanced",
  options: {
    maxSize: 2048,
    padding: 2,
    algorithm: "maxrects",
    sizeMode: "pot",
    cache: true,
    watch: false,
    trim: true,
    extrude: 1,
    rotate: true,
    clean: true
  },
  profile: "unity"
});

console.log(`Batch sample projects written to ${projectsDir}`);

async function writeProject(fileName, project) {
  await fs.writeFile(
    path.join(projectsDir, fileName),
    `${JSON.stringify({ version: 1, ...project }, null, 2)}\n`,
    "utf8"
  );
}
