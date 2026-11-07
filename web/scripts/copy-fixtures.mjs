// Copies the read-only shared fixtures into web/fixtures so the app can import them.
// Never edit shared/fixtures; edit there (via the team) and rerun this.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "shared", "fixtures");
const dst = join(here, "..", "fixtures");
mkdirSync(dst, { recursive: true });
for (const f of ["decisions.json", "rules.json"]) {
  const from = join(src, f);
  if (existsSync(from)) {
    copyFileSync(from, join(dst, f));
    console.log(`[fixtures] copied ${f}`);
  } else if (existsSync(join(dst, f))) {
    console.log(`[fixtures] ${f} not found in shared/, keeping the committed copy`);
  } else {
    console.error(`[fixtures] missing ${from}`);
    process.exit(1);
  }
}
