"use client";
import { motion, useReducedMotion } from "framer-motion";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

export function CapBar({ label, used, cap, currency }: { label: string; used: number; cap: number; currency: string }) {
  const reduce = useReducedMotion();
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const hot = pct >= 85;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-fg-muted">{label}</span>
        <span className="font-mono text-sm tabular text-fg">{formatMoney(cap, currency)}</span>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-ink-700"
        role="progressbar"
        aria-label={`${label}: usado ${pct}%`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className={cn("h-full rounded-full", hot ? "bg-block" : "bg-pass")}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduce ? { duration: 0 } : { duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-sm text-fg-muted tabular">
        <span>Usado hoy {formatMoney(used, currency)}</span>
        <span className={cn("font-semibold", hot ? "text-block-fg" : "text-fg")}>{pct}%</span>
      </div>
    </div>
  );
}
