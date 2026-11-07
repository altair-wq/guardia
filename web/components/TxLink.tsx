import { ExternalLink, FlaskConical } from "lucide-react";
import type { Decision } from "@/lib/types";
import { shortAddress } from "@/lib/format";
import { isSimulatedTx } from "@/lib/tx";
import { cn } from "@/lib/cn";

/** Real tx: "Ver en Arbiscan ↗". Simulated tx (fixtures, mock rate, fixture hash): a badge and no link. */
export function TxLink({ d, className }: { d: Pick<Decision, "quote" | "txHash" | "explorerUrl">; className?: string }) {
  if (!d.txHash && !d.explorerUrl) return null;
  if (isSimulatedTx(d)) {
    return (
      <span
        className={cn(
          "relative z-10 inline-flex min-h-[44px] items-center gap-2 text-sm",
          className,
        )}
      >
        <span className="inline-flex items-center gap-1.5 rounded-chip border border-dashed border-fg-subtle/60 px-2 py-0.5 font-semibold text-fg-muted">
          <FlaskConical aria-hidden className="h-4 w-4" />
          Transacción simulada
        </span>
        {d.txHash && <span className="font-mono text-xs text-fg-subtle">{shortAddress(d.txHash, 4, 4)}</span>}
      </span>
    );
  }
  if (!d.explorerUrl) return null;
  return (
    <a
      href={d.explorerUrl}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "relative z-10 inline-flex min-h-[44px] items-center gap-2 rounded-chip text-sm font-semibold text-pass-fg underline decoration-pass/50 underline-offset-4 hover:decoration-pass",
        className,
      )}
    >
      Ver en Arbiscan
      <ExternalLink aria-hidden className="h-4 w-4" />
      {d.txHash && <span className="font-mono text-xs font-normal text-fg-muted no-underline">{shortAddress(d.txHash, 4, 4)}</span>}
      <span className="sr-only">(se abre en otra pestaña)</span>
    </a>
  );
}
