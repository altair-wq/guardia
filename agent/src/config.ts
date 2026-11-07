import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Supplier } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
export const AGENT_DIR = resolve(here, "..");
export const REPO_DIR = resolve(AGENT_DIR, "..");

// Root .env first, then an optional agent/.env override.
loadEnv({ path: resolve(REPO_DIR, ".env"), quiet: true });
loadEnv({ path: resolve(AGENT_DIR, ".env"), override: true, quiet: true });

const env = process.env;

export const cfg = {
  port: Number(env.AGENT_PORT ?? 8787),
  mockChain: (env.MOCK_CHAIN ?? "true").toLowerCase() !== "false",
  rpcUrl: env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  agentPrivateKey: env.AGENT_PRIVATE_KEY || "",
  llmApiKey: env.LLM_API_KEY || "",
  llmModel: env.LLM_MODEL || "claude-opus-5-5",
  firecrawlApiKey: env.FIRECRAWL_API_KEY || "",
  inboxDir: resolve(REPO_DIR, "demo/inbox"),
  invoicesDir: resolve(REPO_DIR, "demo/invoices"),
  dataFile: resolve(AGENT_DIR, "data/decisions.json"),
  schemaFile: resolve(REPO_DIR, "shared/decision.schema.json"),
  deploymentsFile: resolve(REPO_DIR, "contracts/deployments/arbitrum.json"),
};

export const ADDR = {
  ARGt: "0x59863989d080B22476DB95656d0C3CC18be92214",
  BRAt: "0xC4ed6Aba5373D78E160F4df39e011F078Be54df8",
  USDT0: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  poolARGtUSDT0: "0x356d349da9add7efb56a35fab939a2c6d852f853",
  poolBRAtUSDT0: "0xeef48df5f1c509cd9730774b4e8a4464626ef8d5",
} as const;

export const BELO_URL = "https://api.belo.app/public/price";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadSuppliers(): Supplier[] {
  return readJson<{ suppliers: Supplier[] }>(resolve(AGENT_DIR, "config/suppliers.json")).suppliers;
}

export interface MockVaultConfig {
  vault: string;
  balance: string;
  perPaymentCap: string;
  dailyCap: string;
}
export function loadMockVault(): MockVaultConfig {
  return readJson<MockVaultConfig>(resolve(AGENT_DIR, "config/mock-vault.json"));
}

export interface Deployment {
  chainId: number;
  policyVault: `0x${string}`;
  agent: `0x${string}`;
  abi: unknown[];
}
export function loadDeployment(): Deployment {
  if (!existsSync(cfg.deploymentsFile)) {
    throw new Error(`MOCK_CHAIN=false but ${cfg.deploymentsFile} does not exist yet`);
  }
  return readJson<Deployment>(cfg.deploymentsFile);
}
