import { ExternalLink } from "lucide-react";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

export function TxLink({ href, hash, className }: { href: string | null; hash: string | null; className?: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "relative z-10 inline-flex min-h-[44px] items-center gap-2 rounded-chip text-sm font-semibold text-pass-fg underline decoration-pass/50 underline-offset-4 hover:decoration-pass",
        className,
      )}
    >
      Ver transacción en Arbiscan
      {hash && <span className="font-mono text-xs font-normal text-fg-muted no-underline">{shortAddress(hash, 4, 4)}</span>}
      <ExternalLink aria-hidden className="h-4 w-4" />
      <span className="sr-only">(se abre en otra pestaña)</span>
    </a>
  );
}
