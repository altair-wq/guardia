import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";

// One tint per token so ARGt, BRAt and dollar stablecoins never get confused at a glance.
const TINT: Record<string, string> = {
  ARGt: "bg-sky-100 text-sky-700",
  BRAt: "bg-yellow-100 text-yellow-800",
  USDT0: "bg-teal-100 text-teal-700",
  USDT: "bg-teal-100 text-teal-700",
  USDC: "bg-teal-100 text-teal-700",
};

/** Twin stablecoins track their local currency 1:1, so the fiat hint is the same number. */
const FIAT: Record<string, string> = { ARGt: "ARS", BRAt: "BRL", USDT0: "USD", USDT: "USD", USDC: "USD" };

export function fiatHint(value: string | number, token: string): string | undefined {
  const fiat = FIAT[token];
  return fiat ? `≈ ${fiat} ${formatAmount(value, token)}` : undefined;
}

export function TokenBadge({ token, className }: { token: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.7em] font-semibold leading-none tracking-normal", TINT[token] ?? "bg-ink-800 text-fg-muted", className)}>
      {token}
    </span>
  );
}

/** Amount with its token badge in front and the fiat equivalent on hover. */
export function Money({ value, token, className, strike = false }: { value: string | number; token: string; className?: string; strike?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 tabular", className)} title={fiatHint(value, token)}>
      <TokenBadge token={token} />
      <span className={cn(strike && "line-through decoration-1")}>{formatAmount(value, token)}</span>
    </span>
  );
}
