import type { ConnectionState } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Autonomous-mode pill: dark slate with a pulse while the agent is reachable. */
export function LiveIndicator({ connection }: { connection: ConnectionState }) {
  const ok = connection === "live" || connection === "replay";
  const label = ok ? "En vivo, sin intervención humana" : connection === "connecting" ? "Conectando con el agente…" : "Reconectando con el agente…";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold",
        ok ? "bg-slate-900 text-white" : "bg-block-soft text-block-fg",
      )}
    >
      <span aria-hidden className="relative flex h-2.5 w-2.5">
        {ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />}
        <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", ok ? "bg-emerald-400" : "bg-block")} />
      </span>
      {label}
    </div>
  );
}
