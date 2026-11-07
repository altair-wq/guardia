import Link from "next/link";
import { Ban, Check, Loader2, ShieldX } from "lucide-react";
import type { Decision } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { toneOf, verdictWord } from "@/lib/headline";
import { cn } from "@/lib/cn";

const ICON = { pass: Check, block: Ban, wall: ShieldX, work: Loader2 } as const;
const COLOR = { pass: "text-pass-fg", block: "text-block-fg", wall: "text-wall", work: "text-fg-muted" } as const;

/** One quiet line per earlier decision; the detail page holds everything else. */
export function HistoryRow({ d }: { d: Decision }) {
  const tone = toneOf(d);
  const Icon = ICON[tone];
  const stopped = tone === "block" || tone === "wall";
  return (
    <Link
      href={`/decisions/${encodeURIComponent(d.invoiceId)}`}
      className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3.5 hover:bg-ink-950 sm:grid-cols-[1.5rem_minmax(0,1fr)_auto_7rem] sm:px-5"
    >
      <Icon aria-hidden className={cn("h-5 w-5", COLOR[tone], tone === "work" && "animate-spin motion-reduce:animate-none")} />
      <span className="truncate text-base font-medium sm:text-lg">
        {d.status === "rejected_onchain" ? "Dirección fuera de la lista" : d.supplier.name}
      </span>
      <span className={cn("text-right text-base tabular sm:text-lg", stopped ? "text-fg-muted" : "text-fg")}>{formatMoney(d.amount.value, d.amount.currency)}</span>
      <span className={cn("col-start-2 text-sm font-semibold sm:col-start-auto sm:text-right sm:text-base", COLOR[tone])}>
        {verdictWord(d)}
        
      </span>
    </Link>
  );
}
