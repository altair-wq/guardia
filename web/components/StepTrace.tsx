import { Check, Circle, Loader2, Minus, X } from "lucide-react";
import type { Step, StepName, StepStatus } from "@/lib/types";
import { STEP_LABEL, STEP_STATUS_LABEL } from "@/lib/labels";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const DESC: Record<StepName, string> = {
  extract: "Leyó la factura y sacó proveedor, billetera y monto.",
  verify: "Comparó contra el registro de proveedores y la web.",
  score: "Calculó el riesgo con señales de fraude.",
  execute: "Llamó a PolicyVault en Arbitrum.",
};

function describe(s: Step): string {
  if (s.status === "skipped") return s.name === "execute" ? "No llamó al contrato: frenó antes." : "Salteado.";
  if (s.status === "pending") return "Todavía no empezó.";
  if (s.status === "running") return "Trabajando…";
  if (s.status === "failed") return s.name === "execute" ? "La llamada a PolicyVault no movió plata." : "Falló este paso.";
  return DESC[s.name];
}

const ICON: Record<StepStatus, typeof Check> = { pending: Circle, running: Loader2, done: Check, skipped: Minus, failed: X };
const TONE: Record<StepStatus, string> = {
  pending: "border-line text-fg-subtle",
  running: "border-work text-work",
  done: "border-pass bg-pass-soft text-pass-fg",
  skipped: "border-ink-600 text-fg-subtle",
  failed: "border-block bg-block-soft text-block-fg",
};

export function StepTrace({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative space-y-4">
      {steps.map((s, i) => {
        const Icon = ICON[s.status];
        return (
          <li key={s.name} className="relative flex gap-3">
            {i < steps.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-line" />}
            <span className={cn("z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-ink-900", TONE[s.status])}>
              <Icon aria-hidden className={cn("h-4 w-4", s.status === "running" && "animate-spin motion-reduce:animate-none")} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold">
                  {STEP_LABEL[s.name]} <span className="font-normal text-fg-muted">· {STEP_STATUS_LABEL[s.status]}</span>
                </span>
                {s.at && <time dateTime={s.at} className="font-mono text-sm text-fg-muted tabular">{formatTime(s.at)}</time>}
              </div>
              <p className="text-sm text-fg-muted">{describe(s)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
