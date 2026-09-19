import { cp, mkdir, rm } from "node:fs/promises";

const root = import.meta.dir;
const out = `${root}/dist`;
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

async function bundle(entrypoints: string[], minify: boolean): Promise<void> {
  // content script は ES module として読めないので iife にする
  const result = await Bun.build({
    entrypoints,
    outdir: out,
    format: "iife",
    target: "browser",
    minify,
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
}

// X のページで動く側は読めるままにしておく（不具合を DevTools で追いやすい）。React を含む画面側だけ圧縮する
await bundle([`${root}/src/content.ts`, `${root}/src/background.ts`], false);
await bundle([`${root}/ui/options.tsx`, `${root}/ui/popup.tsx`], true);

const css = Bun.spawnSync(["bunx", "@tailwindcss/cli", "-i", `${root}/ui/globals.css`, "-o", `${out}/ui.css`, "--minify"], { cwd: `${root}/..` });
if (css.exitCode !== 0) {
  console.error(css.stderr.toString());
  process.exit(1);
}

await cp(`${root}/static`, out, { recursive: true });
console.log(`built -> ${out}`);
