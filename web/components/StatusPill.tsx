import { Ban, CheckCircle2, Inbox, Loader2, ShieldAlert } from "lucide-react";
import type { DecisionStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";

const STYLE: Record<DecisionStatus, { icon: typeof Ban; cls: string; spin?: boolean }> = {
  received: { icon: Inbox, cls: "bg-work-soft text-work border-work/40" },
  processing: { icon: Loader2, cls: "bg-work-soft text-work border-work/40", spin: true },
  paid: { icon: CheckCircle2, cls: "bg-pass-soft text-pass-fg border-pass/50" },
  blocked: { icon: Ban, cls: "bg-block-soft text-block-fg border-block/60" },
  rejected_onchain: { icon: ShieldAlert, cls: "bg-wall-soft text-block-fg border-wall/60" },
};

export function StatusPill({ status, size = "md" }: { status: DecisionStatus; size?: "md" | "lg" }) {
  const s = STYLE[status];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border font-display font-bold uppercase tracking-wide",
        size === "lg" ? "px-4 py-1.5 text-lg" : "px-3 py-1 text-sm",
        s.cls,
      )}
    >
      <Icon aria-hidden className={cn(size === "lg" ? "h-5 w-5" : "h-4 w-4", s.spin && "animate-spin motion-reduce:animate-none")} />
      {STATUS_LABEL[status]}
    </span>
  );
}
