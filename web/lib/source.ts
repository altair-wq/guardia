import type { ConnectionState, Decision, Rules } from "./types";
import fixtureDecisions from "@/fixtures/decisions.json";
import fixtureRules from "@/fixtures/rules.json";

export interface SourceState {
  decisions: Decision[]; // newest first
  rules: Rules | null;
  rulesError: string | null;
  connection: ConnectionState;
  error: string | null;
  /** Short-lived message for the presenter (e.g. reset refused). Cleared automatically. */
  notice: string | null;
  /** From GET /health: true = agent runs MOCK_CHAIN (simulated txs), false = real Arbitrum, null = unknown. */
  mockChain: boolean | null;
}

export interface DataSource {
  readonly kind: "fixtures" | "live";
  getState(): SourceState;
  subscribe(listener: () => void): () => void;
  /** Fetch one decision (with its full step trace). */
  getDecision(invoiceId: string): Promise<Decision | null>;
  /** Hidden demo shortcut R: POST /demo/reset (live) or restart the replay (fixtures). */
  reset(): Promise<void>;
  start(): void;
}

export const USE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES !== "false";
const ENV_AGENT_URL = (process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8787").replace(/\/$/, "");
const AGENT_URL_KEY = "guardia.agentUrl";

/** Only https URLs (tunnels) or a local agent are accepted as an override. */
function cleanAgentUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Agent base URL. A Cloudflare quick tunnel gets a new URL on every restart, so instead of
 * redeploying Vercel the presenter can open `/?agent=https://xxxx.trycloudflare.com` once:
 * it is remembered in this browser. `/?agent=default` goes back to NEXT_PUBLIC_AGENT_URL.
 */
export function resolveAgentUrl(): string {
  if (typeof window === "undefined") return ENV_AGENT_URL;
  try {
    const param = new URLSearchParams(window.location.search).get("agent");
    if (param === "default") window.localStorage.removeItem(AGENT_URL_KEY);
    else if (param) {
      const clean = cleanAgentUrl(param);
      if (clean) window.localStorage.setItem(AGENT_URL_KEY, clean);
    }
    const saved = window.localStorage.getItem(AGENT_URL_KEY);
    return (saved && cleanAgentUrl(saved)) || ENV_AGENT_URL;
  } catch {
    return ENV_AGENT_URL;
  }
}

const EMPTY: SourceState = {
  decisions: [],
  rules: null,
  rulesError: null,
  connection: "connecting",
  error: null,
  notice: null,
  mockChain: null,
};

abstract class BaseSource implements DataSource {
  abstract readonly kind: "fixtures" | "live";
  protected state: SourceState = EMPTY;
  private listeners = new Set<() => void>();
  private started = false;

  getState() {
    return this.state;
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  protected set(patch: Partial<SourceState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  protected upsert(d: Decision) {
    const rest = this.state.decisions.filter((x) => x.invoiceId !== d.invoiceId);
    const next = [d, ...rest].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    this.set({ decisions: next });
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.run();
  }
  protected abstract run(): void;
  abstract getDecision(invoiceId: string): Promise<Decision | null>;
  abstract reset(): Promise<void>;
}

// ---------------------------------------------------------------------------
// FixtureSource: replays shared/fixtures so the feed comes alive with no agent.
// Every 6 s the next decision (oldest first) arrives as `processing`, its steps
// advance one per second, then it lands on its final status.
// ---------------------------------------------------------------------------
const ARRIVAL_MS = 6000;
const STEP_MS = 1000;

export class FixtureSource extends BaseSource {
  readonly kind = "fixtures" as const;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly queue: Decision[] = [...(fixtureDecisions as Decision[])].sort((a, b) =>
    a.receivedAt.localeCompare(b.receivedAt),
  );
  private readonly baseRules = fixtureRules as Rules;

  protected run() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.set({ decisions: [], connection: "replay", error: null, rules: this.rulesFor([]) });
    // First invoice lands quickly so the demo does not open on dead air.
    this.queue.forEach((d, i) => this.after(1500 + i * ARRIVAL_MS, () => this.play(d)));
  }

  private after(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  private rulesFor(decisions: Decision[]): Rules {
    const spent = decisions
      .filter((d) => d.status === "paid" && d.amount.currency === "ARGt")
      .reduce((s, d) => s + Number(d.amount.value), 0);
    const startBalance = Number(this.baseRules.balance.value) + Number(this.baseRules.spentToday);
    return {
      ...this.baseRules,
      spentToday: String(spent),
      balance: { ...this.baseRules.balance, value: String(startBalance - spent) },
    };
  }

  protected upsert(d: Decision) {
    super.upsert(d);
    this.set({ rules: this.rulesFor(this.state.decisions) });
  }

  private play(final: Decision) {
    const t0 = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const base: Decision = {
      ...final,
      receivedAt: iso(t0),
      status: "processing",
      reason: "Analizando la factura.",
      quote: null,
      risk: { score: 0, level: "low", signals: [] },
      steps: final.steps.map((s) => ({ name: s.name, status: "pending" as const })),
      txHash: null,
      explorerUrl: null,
    };
    this.upsert(base);

    const steps = base.steps.map((s) => ({ ...s }));
    final.steps.forEach((target, i) => {
      // tick i: step i is running (or lands directly if it was skipped)
      this.after(i * STEP_MS + 200, () => {
        if (target.status === "pending") return; // fixture says this step has not started
        steps[i] = target.status === "skipped" ? { name: target.name, status: "skipped" } : { name: target.name, status: "running", at: iso(Date.now()) };
        this.upsert({ ...this.current(final.invoiceId, base), steps: steps.map((s) => ({ ...s })) });
      });
      this.after((i + 1) * STEP_MS, () => {
        if (target.status === "running" || target.status === "pending") return; // fixture freezes mid-run
        steps[i] = target.status === "skipped" ? { name: target.name, status: "skipped" } : { name: target.name, status: target.status, at: iso(Date.now()) };
        const patch: Partial<Decision> = { steps: steps.map((s) => ({ ...s })) };
        if (target.name === "verify" && final.quote) patch.quote = final.quote;
        if (target.name === "score") patch.risk = final.risk;
        this.upsert({ ...this.current(final.invoiceId, base), ...patch });
      });
    });

    this.after(final.steps.length * STEP_MS + 300, () => {
      if (final.status === "processing" || final.status === "received") {
        // Keep it in flight but show what the fixture knows so far.
        this.upsert({ ...this.current(final.invoiceId, base), quote: final.quote, risk: final.risk });
        return;
      }
      this.upsert({
        ...this.current(final.invoiceId, base),
        status: final.status,
        reason: final.reason,
        quote: final.quote,
        risk: final.risk,
        txHash: final.txHash,
        explorerUrl: final.explorerUrl,
      });
    });
  }

  private current(id: string, fallback: Decision): Decision {
    return this.state.decisions.find((d) => d.invoiceId === id) ?? fallback;
  }

  async getDecision(invoiceId: string) {
    return (
      this.state.decisions.find((d) => d.invoiceId === invoiceId) ??
      (fixtureDecisions as Decision[]).find((d) => d.invoiceId === invoiceId) ??
      null
    );
  }

  async reset() {
    this.run();
  }
}

// ---------------------------------------------------------------------------
// LiveSource: GET /decisions and /rules, then SSE /events with auto-reconnect.
// ---------------------------------------------------------------------------
export class LiveSource extends BaseSource {
  readonly kind = "live" as const;
  private es: EventSource | null = null;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly base: string) {
    super();
  }

  protected run() {
    void this.connect();
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  async refreshRules() {
    try {
      this.set({ rules: await this.json<Rules>("/rules"), rulesError: null });
    } catch (error) {
      this.set({
        rulesError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Non-fatal: an older agent without /health just leaves mockChain unknown. */
  private async refreshHealth() {
    try {
      const h = await this.json<{ ok?: boolean; mockChain?: boolean }>("/health");
      this.set({ mockChain: typeof h.mockChain === "boolean" ? h.mockChain : null });
    } catch {
      /* keep previous value */
    }
  }

  private async connect() {
    this.es?.close();
    this.set({ connection: this.retry === 0 ? "connecting" : "reconnecting" });
    try {
      const [decisions, rules] = await Promise.all([
        this.json<Decision[]>("/decisions"),
        this.json<Rules>("/rules"),
      ]);
      void this.refreshHealth();
      this.set({
        decisions: [...decisions].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
        rules,
        rulesError: null,
        error: null,
      });
    } catch (e) {
      this.set({ error: (e as Error).message });
      return this.scheduleReconnect();
    }

    const es = new EventSource(`${this.base}/events`);
    this.es = es;
    es.onopen = () => {
      this.retry = 0;
      this.set({ connection: "live", error: null });
    };
    es.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data) as Decision;
        if (!d?.invoiceId) return;
        const prev = this.state.decisions.find((x) => x.invoiceId === d.invoiceId);
        this.upsert(d);
        if (prev?.status !== d.status && d.status !== "processing" && d.status !== "received") void this.refreshRules();
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => {
      es.close();
      if (this.es === es) this.es = null;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.retryTimer) return;
    this.set({ connection: "reconnecting" });
    const delay = Math.min(1000 * 2 ** this.retry, 10_000);
    this.retry += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  async getDecision(invoiceId: string) {
    const known = this.state.decisions.find((d) => d.invoiceId === invoiceId);
    try {
      return await this.json<Decision>(`/decisions/${encodeURIComponent(invoiceId)}`);
    } catch {
      return known ?? null;
    }
  }

  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private notify(msg: string) {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.set({ notice: msg });
    this.noticeTimer = setTimeout(() => this.set({ notice: null }), 5000);
  }

  async reset() {
    let res: Response;
    try {
      res = await fetch(`${this.base}/demo/reset`, { method: "POST" });
    } catch {
      this.notify("Reset falló: no pude hablar con el agente");
      return; // keep the feed
    }
    if (res.status === 401 || res.status === 403) {
      this.notify("Reset bloqueado: hace falta la clave del agente");
      return; // keep the feed
    }
    if (!res.ok) {
      this.notify(`Reset falló (HTTP ${res.status})`);
      return;
    }
    this.set({ decisions: [], notice: null });
    await this.refreshRules();
  }
}

let singleton: DataSource | null = null;
export function getSource(): DataSource {
  if (!singleton) singleton = USE_FIXTURES ? new FixtureSource() : new LiveSource(resolveAgentUrl());
  return singleton;
}

/** True when tx hashes cannot exist on Arbiscan: fixtures replay or an agent on MOCK_CHAIN. */
export function chainIsSimulated(): boolean {
  if (USE_FIXTURES) return true;
  return singleton?.getState().mockChain === true;
}

/** Base URL the live source talks to (for the footer / debugging). */
export function activeAgentUrl(): string | null {
  return singleton instanceof LiveSource ? singleton.base : null;
}
