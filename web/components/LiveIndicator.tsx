import type { ConnectionState } from "@/lib/types";
import { cn } from "@/lib/cn";

export function LiveIndicator({ connection }: { connection: ConnectionState }) {
  const ok = connection === "live" || connection === "replay";
  const label = ok ? "En vivo · sin intervención humana" : connection === "connecting" ? "Conectando con el agente…" : "Reconectando con el agente…";
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn("h-3 w-3 rounded-full", ok ? "animate-pulse-dot bg-pass motion-reduce:animate-none" : "bg-block")}
      />
      <span className={cn("text-sm font-semibold sm:text-base", ok ? "text-fg" : "text-block-fg")}>{label}</span>
    </div>
  );
}
