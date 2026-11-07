import type { Decision } from "@/lib/types";
import { cn } from "@/lib/cn";
import { SignalList } from "./SignalChip";

const LEVEL = { low: "bajo", medium: "medio", high: "alto" } as const;

export function RiskScore({ risk }: { risk: Decision["risk"] }) {
  const high = risk.level === "high";
  return (
    <div>
      <div className="flex items-end gap-3">
        <span className={cn("text-5xl font-bold leading-none tracking-[-0.02em] tabular", high ? "text-block-fg" : risk.level === "medium" ? "text-fg" : "text-pass-fg")}>
          {risk.score}
        </span>
        <span className="pb-1 text-base text-fg-muted">de 100, riesgo {LEVEL[risk.level]}</span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-ink-800"
        role="meter"
        aria-label="Puntaje de riesgo"
        aria-valuenow={risk.score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-full rounded-full", high ? "bg-block" : "bg-pass")} style={{ width: `${risk.score}%` }} />
      </div>
      <div className="mt-4">
        {risk.signals.length ? <SignalList signals={risk.signals} /> : <p className="text-sm text-fg-muted">Sin señales de fraude.</p>}
      </div>
    </div>
  );
}
