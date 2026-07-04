import { promises as fs } from "node:fs";

await fs.rm("dist", { recursive: true, force: true });
await fs.rm("samples/output", { recursive: true, force: true });
await fs.rm("samples/output-advanced", { recursive: true, force: true });
await fs.rm("samples/output-multipack", { recursive: true, force: true });

console.log("Removed dist, samples/output, samples/output-advanced, and samples/output-multipack.");
