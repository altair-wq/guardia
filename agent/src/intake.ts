import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { watch } from "chokidar";
import { cfg } from "./config.js";

export const SUPPORTED = [".pdf", ".txt", ".eml"];

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function pdfText(buf: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    // pdf-parse returns every text object, including white/hidden text: exactly what we want to inspect.
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

function decodeQP(s: string): string {
  const bytes = s
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return Buffer.from(bytes, "latin1").toString("utf8");
}

/** Minimal .eml reader: keeps Subject/From and every text part, HTML tags stripped but hidden text kept. */
export function emlText(raw: string): string {
  const headerEnd = raw.search(/\r?\n\r?\n/);
  const headers = headerEnd === -1 ? raw : raw.slice(0, headerEnd);
  const keep = headers
    .split(/\r?\n/)
    .filter((l) => /^(from|subject|date|to):/i.test(l))
    .join("\n");
  const parts = raw.split(/\r?\n--[^\r\n]+/);
  const bodies = parts.map((p) => {
    const end = p.search(/\r?\n\r?\n/);
    const h = end === -1 ? "" : p.slice(0, end);
    let b = end === -1 ? p : p.slice(end);
    if (/content-transfer-encoding:\s*quoted-printable/i.test(h)) b = decodeQP(b);
    else if (/content-transfer-encoding:\s*base64/i.test(h) && /content-type:\s*text\//i.test(h)) {
      b = Buffer.from(b.replace(/\s+/g, ""), "base64").toString("utf8");
    } else if (/content-type:\s*(?!text\/)/i.test(h)) return ""; // skip binary attachments
    return b.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  });
  return `${keep}\n${bodies.join("\n")}`.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export async function toText(buf: Buffer, filename: string): Promise<string> {
  const ext = extname(filename).toLowerCase();
  if (ext === ".pdf") return pdfText(buf);
  if (ext === ".eml") return emlText(buf.toString("utf8"));
  return buf.toString("utf8");
}

export type Submit = (buf: Buffer, filename: string) => Promise<{ invoiceId: string; duplicate: boolean }>;

/** Watch demo/inbox: dropping a file starts an autonomous run. */
export function watchInbox(submit: Submit, log: (m: string) => void) {
  const watcher = watch(cfg.inboxDir, {
    ignoreInitial: false,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    ignored: (p: string) => basename(p).startsWith("."),
  });
  watcher.on("add", async (path) => {
    if (!SUPPORTED.includes(extname(path).toLowerCase())) return;
    try {
      const r = await submit(readFileSync(path), basename(path));
      log(`${r.duplicate ? "duplicate" : "new"} invoice from inbox: ${basename(path)} -> ${r.invoiceId}`);
    } catch (e) {
      log(`could not ingest ${basename(path)}: ${(e as Error).message}`);
    }
  });
  return watcher;
}

export function clearInbox(): void {
  for (const f of readdirSync(cfg.inboxDir)) {
    if (f.startsWith(".")) continue; // keep .gitkeep
    rmSync(join(cfg.inboxDir, f), { force: true, recursive: true });
  }
}
