#!/usr/bin/env node
// Records the backup video: opens the dashboard in Chromium, runs demo/run.sh, and saves
// the dashboard recording to demo/backup-video/guardia-demo.mp4 (webm if ffmpeg is missing).
// Start agent + dashboard first (./demo/start.sh).
//   WEB_URL=http://localhost:3000 node demo/record-backup.mjs
// A screen recording with the terminal visible (QuickTime / OBS) is still nicer for the jury;
// this one is the fallback that needs no hands.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DEMO_DIR, ROOT } from "./lib.mjs";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  console.error("playwright not found: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const WEB_URL = process.env.WEB_URL || "http://localhost:3000";
const OUT = join(DEMO_DIR, "backup-video");
const RAW = join(OUT, "raw");
mkdirSync(RAW, { recursive: true });

const browser = await playwright.chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: RAW, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
await page.goto(WEB_URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

console.log(`[record] recording ${WEB_URL}, running demo/run.sh`);
const run = spawn("bash", [join(DEMO_DIR, "run.sh")], { cwd: ROOT, stdio: "inherit" });
await new Promise((r) => run.on("exit", r));
await page.waitForTimeout(Number(process.env.RECORD_TAIL_MS || 15000)); // let the last decisions settle on screen

const video = page.video();
await context.close();
await browser.close();
const webm = await video.path();

const mp4 = join(OUT, "guardia-demo.mp4");
const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
if (ff.status === 0) {
  rmSync(RAW, { recursive: true, force: true });
  console.log(`[record] saved ${mp4}`);
} else {
  const dest = join(OUT, "guardia-demo.webm");
  renameSync(webm, dest);
  for (const f of readdirSync(RAW)) rmSync(join(RAW, f));
  console.log(`[record] ffmpeg failed, saved ${dest}`);
}
