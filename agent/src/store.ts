import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { cfg } from "./config.js";
import type { Decision } from "./types.js";

const ajv = new Ajv2020({ allErrors: true, strict: false });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
const schema = JSON.parse(readFileSync(cfg.schemaFile, "utf8"));
delete schema.$schema;
export const validateDecision = ajv.compile<Decision>(schema);

interface Persisted {
  decisions: Decision[];
  hashes: Record<string, string>; // content sha256 -> invoiceId (idempotency)
  /** Highest invoice number ever issued. Survives /demo/reset because PolicyVault rejects a reused invoiceId (AlreadyPaid). */
  lastSeq?: number;
}

export class Store extends EventEmitter {
  private state: Persisted = { decisions: [], hashes: {} };

  constructor(private readonly file: string | null) {
    super();
    if (file && existsSync(file)) {
      try {
        this.state = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        console.warn(`[store] could not read ${file}, starting empty`);
      }
    }
  }

  list(): Decision[] {
    return [...this.state.decisions].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : a.receivedAt > b.receivedAt ? -1 : b.invoiceId.localeCompare(a.invoiceId)));
  }

  get(id: string): Decision | undefined {
    return this.state.decisions.find((d) => d.invoiceId === id);
  }

  byHash(hash: string): string | undefined {
    return this.state.hashes[hash];
  }

  nextId(): string {
    const max = this.state.decisions.reduce((m, d) => Math.max(m, Number(d.invoiceId.replace(/\D/g, "")) || 0), this.state.lastSeq ?? 0);
    this.state.lastSeq = max + 1;
    return `inv_${String(max + 1).padStart(3, "0")}`;
  }

  /** Insert or replace a decision; validates against shared/decision.schema.json before emitting. */
  save(d: Decision, hash?: string): void {
    if (!validateDecision(d)) {
      console.error(`[store] decision ${(d as Decision).invoiceId} failed schema validation, not emitted:`, ajv.errorsText(validateDecision.errors));
      return;
    }
    const copy = structuredClone(d);
    const i = this.state.decisions.findIndex((x) => x.invoiceId === d.invoiceId);
    if (i === -1) this.state.decisions.push(copy);
    else this.state.decisions[i] = copy;
    if (hash) this.state.hashes[hash] = d.invoiceId;
    this.persist();
    this.emit("decision", copy);
  }

  reset(): void {
    // Keep the counter: on-chain invoice ids must never repeat.
    this.state = { decisions: [], hashes: {}, lastSeq: this.state.lastSeq };
    this.persist();
  }

  private persist(): void {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    renameSync(tmp, this.file);
  }
}
