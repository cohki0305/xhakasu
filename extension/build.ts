import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = import.meta.dir;
const out = `${root}/dist`;
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// content script は ES module として読めないので iife にする
const entries = ["content", "background", "options", "popup"].map((n) => `${root}/src/${n}.ts`).filter(existsSync);
const result = await Bun.build({ entrypoints: entries, outdir: out, format: "iife", target: "browser", minify: false });
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await cp(`${root}/static`, out, { recursive: true });
console.log(`built ${entries.length} entries -> ${out}`);
