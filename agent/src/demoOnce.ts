// Process every invoice in demo/invoices (or the folder given as argv[2]) once and print each Decision.
// Uses an in-memory store so it never touches agent/data or the running server.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { AGENT_DIR, cfg, loadSuppliers } from "./config.js";
import { createVault } from "./execute.js";
import { SUPPORTED } from "./intake.js";
import { Pipeline } from "./pipeline.js";
import { Store } from "./store.js";

const pick = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => SUPPORTED.includes(extname(f).toLowerCase())).sort() : []);

let dir = process.argv[2] ? resolve(process.argv[2]) : cfg.invoicesDir;
if (!process.argv[2] && pick(dir).length === 0) {
  dir = join(AGENT_DIR, "test/fixtures/invoices");
  console.log(`demo/invoices is empty, using ${dir}`);
}

const store = new Store(null);
const pipeline = new Pipeline(store, createVault(), loadSuppliers, (m) => console.log(`  ${m}`));

for (const f of pick(dir)) {
  console.log(`\n=== ${f}`);
  const { invoiceId } = await pipeline.submit(readFileSync(join(dir, f)), f);
  await pipeline.idle();
  console.log(JSON.stringify(store.get(invoiceId), null, 2));
}
