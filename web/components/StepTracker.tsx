"use client";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Minus, X } from "lucide-react";
import type { Step, StepStatus } from "@/lib/types";
import { STEP_LABEL, STEP_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";

const ICON: Record<StepStatus, typeof Check | null> = { pending: null, running: Loader2, done: Check, skipped: Minus, failed: X };

const FILL: Record<StepStatus, string> = {
  pending: "0%",
  running: "50%",
  done: "100%",
  skipped: "100%",
  failed: "100%",
};

const BAR: Record<StepStatus, string> = {
  pending: "bg-transparent",
  running: "bg-sky",
  done: "bg-pass",
  skipped: "bg-ink-600",
  failed: "bg-block",
};

const TEXT: Record<StepStatus, string> = {
  pending: "text-fg-subtle",
  running: "text-fg",
  done: "text-pass-fg",
  skipped: "text-fg-subtle",
  failed: "text-block-fg",
};

export function StepTracker({ steps }: { steps: Step[] }) {
  const reduce = useReducedMotion();
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Pasos del agente">
      {steps.map((s) => {
        const Icon = ICON[s.status];
        return (
          <li key={s.name} className="min-w-0">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
              <motion.div
                className={cn("h-full rounded-full", BAR[s.status])}
                initial={false}
                animate={{ width: FILL[s.status] }}
                transition={reduce ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <div className={cn("mt-2 flex items-center gap-1 text-sm font-semibold", TEXT[s.status])}>
              {Icon && (
                <Icon aria-hidden className={cn("h-4 w-4 shrink-0", s.status === "running" && "animate-spin motion-reduce:animate-none")} />
              )}
              <span className="truncate">{STEP_LABEL[s.name]}</span>
            </div>
            <span className="sr-only">: {STEP_STATUS_LABEL[s.status]}</span>
            {s.status === "running" && <span className="block text-xs text-fg-muted">en curso</span>}
          </li>
        );
      })}
    </ol>
  );
}
