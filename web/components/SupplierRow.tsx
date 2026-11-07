import { Check } from "lucide-react";
import type { RulesSupplier } from "@/lib/types";
import { shortAddress } from "@/lib/format";
import { TokenBadge } from "./TokenBadge";

export function SupplierRow({ s }: { s: RulesSupplier }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-pass/60 bg-pass-soft">
        <Check aria-hidden className="h-4 w-4 text-pass-fg" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{s.name}</div>
        <div className="font-mono text-xs text-fg-muted" title={s.wallet}>
          {shortAddress(s.wallet)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 font-mono text-xs">
        <span className="rounded-chip border border-line px-1.5 py-0.5 text-fg-muted">{s.country}</span>
        <TokenBadge token={s.payToken} className="text-xs" />
      </div>
    </li>
  );
}
