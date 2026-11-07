import { AlertTriangle } from "lucide-react";
import type { Signal } from "@/lib/types";
import { SIGNAL_LABEL } from "@/lib/labels";

export function SignalChip({ signal }: { signal: Signal }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-chip border border-block/50 bg-block-soft px-2.5 py-1 text-sm font-medium text-block-fg">
      <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
      {SIGNAL_LABEL[signal] ?? signal}
    </span>
  );
}

export function SignalList({ signals }: { signals: Signal[] }) {
  if (!signals.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Señales de riesgo">
      {signals.map((s) => (
        <li key={s}>
          <SignalChip signal={s} />
        </li>
      ))}
    </ul>
  );
}
