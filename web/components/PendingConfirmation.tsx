import type { Decision } from "@/lib/types";
import { cn } from "@/lib/cn";
import { TxLink } from "./TxLink";

/** Broadcast, no receipt yet: money MAY have moved, so never say it did not. */
export function PendingConfirmation({ d, className }: { d: Decision; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      <p className="flex items-center gap-2.5 text-base font-semibold text-fg sm:text-lg">
        <span aria-hidden className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-work opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-work" />
        </span>
        Pago enviado, esperando confirmación en la red
      </p>
      <TxLink d={d} />
    </div>
  );
}
