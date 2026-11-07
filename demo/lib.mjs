// Shared helpers for the demo scripts: load .env, suppliers, deployment and caps.
// Every source has a fallback so the demo works with mocks before the real parts exist.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEMO_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(DEMO_DIR, "..");
export const INBOX = join(DEMO_DIR, "inbox");
export const INVOICES = join(DEMO_DIR, "invoices");

const p = (...parts) => join(ROOT, ...parts);

export function loadEnv() {
  const envPath = p(".env");
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch (e) {
      console.warn(`[demo] could not parse .env: ${e.message}`);
    }
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Suppliers: agent/config/suppliers.json (real allowlisted wallets) or the shared fixture. */
export function loadSuppliers() {
  const real = p("agent", "config", "suppliers.json");
  if (existsSync(real)) {
    const data = readJson(real);
    const list = Array.isArray(data) ? data : data.suppliers;
    return { source: "agent/config/suppliers.json", suppliers: list };
  }
  return { source: "shared/fixtures/rules.json (fallback)", suppliers: readJson(p("shared", "fixtures", "rules.json")).suppliers };
}

/** Deployment written by contracts/: { chainId, policyVault, agent, abi } or null. */
export function loadDeployment() {
  const path = p("contracts", "deployments", "arbitrum.json");
  return existsSync(path) ? readJson(path) : null;
}

export const AGENT_URL = () => process.env.AGENT_URL || process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8787";

export function isMock() {
  return String(process.env.MOCK_CHAIN ?? "true").toLowerCase() !== "false" || !loadDeployment();
}

/**
 * Caps in human ARGt units (decimal strings). Order of truth:
 * 1. PER_PAYMENT_CAP / DAILY_CAP env overrides
 * 2. the vault itself (perPaymentCap()/dailyCap() getters) when a deployment + RPC exist
 * 3. the agent's GET /rules (which reads the vault in live mode)
 * 4. shared/fixtures/rules.json
 */
export async function loadCaps() {
  if (process.env.PER_PAYMENT_CAP && process.env.DAILY_CAP) {
    return { source: "env", perPaymentCap: process.env.PER_PAYMENT_CAP, dailyCap: process.env.DAILY_CAP };
  }
  const dep = loadDeployment();
  if (dep && process.env.ARBITRUM_RPC_URL) {
    try {
      const { createPublicClient, http, formatUnits, parseAbi } = await import("viem");
      const { arbitrum } = await import("viem/chains");
      const client = createPublicClient({ chain: arbitrum, transport: http(process.env.ARBITRUM_RPC_URL) });
      const abi = parseAbi(["function perPaymentCap() view returns (uint256)", "function dailyCap() view returns (uint256)"]);
      const [per, daily] = await Promise.all([
        client.readContract({ address: dep.policyVault, abi, functionName: "perPaymentCap" }),
        client.readContract({ address: dep.policyVault, abi, functionName: "dailyCap" }),
      ]);
      return { source: `vault ${dep.policyVault}`, perPaymentCap: formatUnits(per, 18), dailyCap: formatUnits(daily, 18) };
    } catch (e) {
      console.warn(`[demo] could not read caps from the vault: ${e.shortMessage || e.message}`);
    }
  }
  try {
    const res = await fetch(`${AGENT_URL()}/rules`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const r = await res.json();
      return { source: `agent ${AGENT_URL()}/rules`, perPaymentCap: r.perPaymentCap, dailyCap: r.dailyCap };
    }
  } catch {
    /* agent not running: fall through */
  }
  const r = readJson(p("shared", "fixtures", "rules.json"));
  return { source: "shared/fixtures/rules.json (fallback)", perPaymentCap: r.perPaymentCap, dailyCap: r.dailyCap };
}

/** Human-unit decimal string * fraction, rounded down to 2 decimals (small Twin test amounts need decimals). */
export function fraction(capStr, f) {
  const v = Math.floor(Number(capStr) * f * 100) / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** Deterministic attacker address so the README and the demo always show the same "bad" wallet. */
export const ATTACKER_WALLET = "0xbad0c0ffee5ca1ab1e0000000000000000000666";
