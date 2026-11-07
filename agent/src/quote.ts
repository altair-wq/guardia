import { createPublicClient, formatUnits, http, parseAbi, parseUnits } from "viem";
import { arbitrum } from "viem/chains";
import { ADDR, BELO_URL, cfg } from "./config.js";
import type { Currency, Quote } from "./types.js";
import { withTimeout } from "./verify.js";

export const publicClient = createPublicClient({ chain: arbitrum, transport: http(cfg.rpcUrl, { timeout: 10_000 }) });

// Twin's pools are Curve cryptoswap pools: uint256 indices. Verified on-chain:
// ARGt/USDT0 pool: coins(0)=ARGt, coins(1)=USDT0. BRAt/USDT0 pool: coins(0)=BRAt, coins(1)=USDT0.
const CURVE_ABI = parseAbi(["function get_dy(uint256 i, uint256 j, uint256 dx) view returns (uint256)"]);
const DEC = { ARGt: 18, USDT0: 6, BRAt: 18 } as const;
const SLIPPAGE_BPS = 200n; // minAmountOut = expected * 0.98

export interface QuoteResult {
  quote: Quote;
  /** Raw slippage floor in pay-token base units, sent to PolicyVault.pay. */
  minAmountOutWei: bigint;
}

/** On-chain truth: ARGt -> USDT0 -> BRAt via Curve get_dy. */
export async function curveQuoteARGtToBRAt(amountARGt: string): Promise<{ expected: bigint; min: bigint }> {
  const dx = parseUnits(amountARGt, DEC.ARGt);
  const usdt = await publicClient.readContract({
    address: ADDR.poolARGtUSDT0,
    abi: CURVE_ABI,
    functionName: "get_dy",
    args: [0n, 1n, dx],
  });
  const brat = await publicClient.readContract({
    address: ADDR.poolBRAtUSDT0,
    abi: CURVE_ABI,
    functionName: "get_dy",
    args: [1n, 0n, usdt],
  });
  return { expected: brat, min: (brat * (10_000n - SLIPPAGE_BPS)) / 10_000n };
}

// ---- Belo reference price -------------------------------------------------
// The public endpoint was not reachable from the build sandbox, so its shape is parsed
// defensively: we look for USDT (or USD) quotes against ARS and BRL with ask/bid/price fields.
// TODO(team): curl https://api.belo.app/public/price once and tighten this type.
type BeloEntry = Record<string, unknown>;

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function midOf(e: BeloEntry): number | null {
  const ask = num(e.ask ?? e.sell ?? e.venta);
  const bid = num(e.bid ?? e.buy ?? e.compra);
  if (ask && bid) return (ask + bid) / 2;
  return num(e.price ?? e.mid ?? e.last ?? e.value ?? ask ?? bid);
}

function collect(node: unknown, path: string, out: { key: string; entry: BeloEntry }[]): void {
  if (Array.isArray(node)) node.forEach((n, i) => collect(n, `${path}[${i}]`, out));
  else if (node && typeof node === "object") {
    const o = node as BeloEntry;
    const label = [path, ...Object.values(o).filter((v) => typeof v === "string")].join(" ").toUpperCase();
    if (midOf(o) !== null) out.push({ key: label, entry: o });
    for (const [k, v] of Object.entries(o)) if (v && typeof v === "object") collect(v, `${path}.${k}`, out);
  }
}

/** Units of local fiat per 1 USD(T), from Belo. */
export function beloUsdRates(json: unknown): { ARS?: number; BRL?: number } {
  const entries: { key: string; entry: BeloEntry }[] = [];
  collect(json, "", entries);
  const pick = (fiat: string) => {
    const e = entries.find((x) => /USDT?|USD/.test(x.key) && x.key.includes(fiat));
    return e ? midOf(e.entry) ?? undefined : undefined;
  };
  return { ARS: pick("ARS"), BRL: pick("BRL") };
}

let beloShapeLogged = false;
export async function beloReferenceRate(log: (m: string) => void): Promise<number | null> {
  try {
    const res = await withTimeout(fetch(BELO_URL), 4000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json();
    if (!beloShapeLogged) {
      beloShapeLogged = true;
      log(`belo response sample: ${JSON.stringify(json).slice(0, 300)}`);
    }
    const r = beloUsdRates(json);
    if (!r.ARS || !r.BRL) throw new Error("ARS/BRL not found in response");
    return r.BRL / r.ARS; // BRL per ARS
  } catch (e) {
    log(`belo price unavailable, keeping Curve quote: ${(e as Error).message}`);
    return null;
  }
}

/** Fallback used only in MOCK_CHAIN mode when the RPC is unreachable. */
const MOCK_BRAt_PER_ARGt = 0.0033;

export async function quote(amountARGt: string, payToken: Currency, log: (m: string) => void): Promise<QuoteResult> {
  if (payToken === "ARGt") {
    const wei = parseUnits(amountARGt, DEC.ARGt);
    return { quote: { route: ["ARGt"], amountOut: amountARGt, source: "direct", minAmountOut: amountARGt }, minAmountOutWei: wei };
  }
  if (payToken !== "BRAt") throw new Error(`no route for ${payToken}`);

  const belo = beloReferenceRate(log);
  let expected: bigint;
  let min: bigint;
  let curveOk = true;
  try {
    ({ expected, min } = await curveQuoteARGtToBRAt(amountARGt));
  } catch (e) {
    curveOk = false;
    if (!cfg.mockChain) throw e;
    log(`curve quote failed in mock mode, using fixed rate: ${(e as Error).message}`);
    expected = parseUnits((Number(amountARGt) * MOCK_BRAt_PER_ARGt).toFixed(18), DEC.BRAt);
    min = (expected * (10_000n - SLIPPAGE_BPS)) / 10_000n;
  }
  const ref = await belo;
  const q: Quote = {
    route: ["ARGt", "USDT0", "BRAt"],
    amountOut: Number(formatUnits(expected, DEC.BRAt)).toFixed(2),
    // The amount always comes from Curve get_dy (or the mock fixed rate); Belo is only a reference.
    source: curveOk ? "curve" : "mock-fixed-rate",
    minAmountOut: Number(formatUnits(min, DEC.BRAt)).toFixed(2),
  };
  if (ref) q.referenceRate = ref.toPrecision(6);
  return { quote: q, minAmountOutWei: min };
}
