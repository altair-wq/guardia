import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { cfg, loadSuppliers } from "./config.js";
import { createVault } from "./execute.js";
import { clearInbox, watchInbox } from "./intake.js";
import { Pipeline } from "./pipeline.js";
import { Store } from "./store.js";
import type { Decision } from "./types.js";

const app = Fastify({ logger: { level: "info" }, bodyLimit: 15 * 1024 * 1024 });
await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024 } });

const log = (m: string) => app.log.info(m);
const store = new Store(cfg.dataFile);
const vault = createVault();
const pipeline = new Pipeline(store, vault, loadSuppliers, log);

// --- API (SHARED_CONTRACTS.md section B) -----------------------------------
app.post("/invoices", async (req, reply) => {
  let buf: Buffer;
  let filename: string;
  if (req.isMultipart()) {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "missing file" });
    buf = await file.toBuffer();
    filename = file.filename || "invoice.txt";
  } else {
    const body = req.body as { text?: string } | undefined;
    if (!body?.text) return reply.code(400).send({ error: "send a multipart file or { text }" });
    buf = Buffer.from(body.text, "utf8");
    filename = "invoice.txt";
  }
  const r = await pipeline.submit(buf, filename);
  return { invoiceId: r.invoiceId, duplicate: r.duplicate };
});

app.get("/decisions", async () => store.list());

app.get<{ Params: { invoiceId: string } }>("/decisions/:invoiceId", async (req, reply) => {
  const d = store.get(req.params.invoiceId);
  return d ?? reply.code(404).send({ error: "not found" });
});

app.get("/rules", async () => {
  const s = await vault.state();
  return {
    vault: s.vault,
    chain: "arbitrum",
    balance: { value: s.balance, currency: "ARGt" },
    perPaymentCap: s.perPaymentCap,
    dailyCap: s.dailyCap,
    spentToday: s.spentToday,
    suppliers: loadSuppliers().map(({ name, country, wallet, payToken }) => ({ name, country, wallet, payToken })),
  };
});

app.get("/events", (req, reply) => {
  reply.raw.writeHead(200, {
    ...(reply.getHeaders() as Record<string, string>),
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  reply.raw.write(": connected\n\n");
  const onDecision = (d: Decision) => reply.raw.write(`data: ${JSON.stringify(d)}\n\n`);
  const ping = setInterval(() => reply.raw.write(": ping\n\n"), 15_000);
  store.on("decision", onDecision);
  req.raw.on("close", () => {
    clearInterval(ping);
    store.off("decision", onDecision);
  });
  reply.hijack();
});

app.post("/demo/reset", async () => {
  await pipeline.idle();
  store.reset();
  vault.reset();
  clearInbox();
  log("demo reset: decisions and demo/inbox cleared");
  return { ok: true };
});

app.get("/health", async () => ({ ok: true, mockChain: cfg.mockChain }));

// --- startup -----------------------------------------------------------------
store.setMaxListeners(100);
try {
  const s = await vault.state();
  log(`vault ${s.vault} (${cfg.mockChain ? "MOCK" : "LIVE"}): balance ${s.balance} ARGt, perPaymentCap ${s.perPaymentCap}, dailyCap ${s.dailyCap}, spentToday ${s.spentToday}`);
} catch (e) {
  app.log.error(`could not read vault state: ${(e as Error).message}`);
}
log(`LLM: ${cfg.llmApiKey ? cfg.llmModel : "disabled (heuristic extractor + template reasons)"}; Firecrawl: ${cfg.firecrawlApiKey ? "on" : "off"}`);
watchInbox(pipeline.submit, log);
await app.listen({ port: cfg.port, host: "0.0.0.0" });
