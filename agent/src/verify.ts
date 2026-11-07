import { cfg } from "./config.js";
import type { Extraction, Signal, Supplier } from "./types.js";

const LEGAL_SUFFIXES = /\b(ltda|ltd|srl|s\.?r\.?l|sa|s\.?a|sas|sociedad anonima|eireli|me|epp|inc|llc|cia|y cia)\b\.?/g;

/** Lowercase, strip accents, punctuation and legal suffixes. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Fuzzy match on normalised name: exact, containment, or >= 85% similarity. */
export function findSupplier(name: string, registry: Supplier[]): Supplier | null {
  const n = normalizeName(name);
  if (!n) return null;
  let best: { s: Supplier; sim: number } | null = null;
  for (const s of registry) {
    const r = normalizeName(s.name);
    if (r === n) return s;
    if (n.length >= 6 && r.length >= 6 && (r.includes(n) || n.includes(r))) return s;
    const sim = 1 - levenshtein(n, r) / Math.max(n.length, r.length);
    if (!best || sim > best.sim) best = { s, sim };
  }
  return best && best.sim >= 0.85 ? best.s : null;
}

export function isWalletChanged(invoiceWallet: string, registered: string): boolean {
  return invoiceWallet.trim().toLowerCase() !== registered.trim().toLowerCase();
}

/** Same first 4 and last 4 hex chars as the registered wallet, but not equal. */
export function isLookalike(invoiceWallet: string, registered: string): boolean {
  const a = invoiceWallet.trim().toLowerCase().replace(/^0x/, "");
  const b = registered.trim().toLowerCase().replace(/^0x/, "");
  if (a === b || a.length < 8 || b.length < 8) return false;
  return a.slice(0, 4) === b.slice(0, 4) && a.slice(-4) === b.slice(-4);
}

/** Lookalike against any registered wallet (an attacker may mimic a different supplier). */
export function lookalikeOfAny(invoiceWallet: string, registry: Supplier[]): boolean {
  return registry.some((s) => isLookalike(invoiceWallet, s.wallet));
}

export function isAmountAnomaly(amount: string, avgAmount: string): boolean {
  const a = Number(amount);
  const avg = Number(avgAmount);
  if (!Number.isFinite(a) || !Number.isFinite(avg) || avg <= 0) return false;
  return a > 3 * avg;
}

const COUNTRY_WORDS: Record<string, string[]> = {
  AR: ["argentina"],
  BR: ["brasil", "brazil"],
  CL: ["chile"],
  CO: ["colombia"],
  MX: ["mexico"],
  PE: ["peru"],
  BO: ["bolivia"],
};

/** Pure check used by the website step: does the page mention the company and its country? */
export function websiteMatches(pageText: string, supplier: Supplier): boolean {
  const page = normalizeName(pageText);
  const nameOk = page.includes(normalizeName(supplier.name));
  const words = COUNTRY_WORDS[supplier.country.toUpperCase()] ?? [supplier.country.toLowerCase()];
  const countryOk = words.some((w) => page.includes(w));
  return nameOk && countryOk;
}

/**
 * Scrape the supplier's website with Firecrawl (8 s budget).
 * Returns true (mismatch), false (ok) or null (could not check: never stalls the demo).
 */
export async function checkWebsite(supplier: Supplier, log: (m: string) => void): Promise<boolean | null> {
  if (!supplier.website) return null;
  if (!cfg.firecrawlApiKey) {
    log("website check skipped: FIRECRAWL_API_KEY not set");
    return null;
  }
  try {
    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const fc = new Firecrawl({ apiKey: cfg.firecrawlApiKey });
    const doc = await withTimeout(fc.scrape(supplier.website, { formats: ["markdown"], timeout: 8000 }), 8000);
    const text = (doc as { markdown?: string }).markdown ?? "";
    return !websiteMatches(text, supplier);
  } catch (e) {
    log(`website check failed, continuing: ${(e as Error).message}`);
    return null;
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms} ms`)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

export interface VerifyResult {
  supplier: Supplier | null;
  signals: Signal[];
}

/** Deterministic checks. The LLM never decides these. */
export async function verify(
  ex: Extraction,
  registry: Supplier[],
  opts: { log: (m: string) => void; checkSite?: typeof checkWebsite },
): Promise<VerifyResult> {
  const signals = new Set<Signal>();
  const supplier = findSupplier(ex.supplierName, registry);

  if (!supplier) {
    signals.add("unknown_supplier");
  } else {
    if (!ex.wallet || isWalletChanged(ex.wallet, supplier.wallet)) signals.add("wallet_changed");
    if (isAmountAnomaly(ex.amount, supplier.avgAmount)) signals.add("amount_anomaly");
  }
  if (ex.wallet && lookalikeOfAny(ex.wallet, registry)) signals.add("lookalike_address");
  if (ex.urgentLanguage) signals.add("urgent_language");
  if (ex.injectionDetected) signals.add("prompt_injection");

  if (supplier) {
    const mismatch = await (opts.checkSite ?? checkWebsite)(supplier, opts.log);
    if (mismatch === true) signals.add("website_mismatch");
  }
  return { supplier, signals: [...signals] };
}
