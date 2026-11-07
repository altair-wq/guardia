"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Coins } from "lucide-react";
import type { Decision } from "@/lib/types";
import { countryName, formatAmount, formatMoney, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { StatusPill } from "./StatusPill";
import { SignalList } from "./SignalChip";
import { StepTracker } from "./StepTracker";
import { RouteChips } from "./RouteChips";
import { TxLink } from "./TxLink";
import { Stamp } from "./Stamp";
import { PendingConfirmation } from "./PendingConfirmation";
import { displaySteps, isAwaitingConfirmation, isCurrencyBlock } from "@/lib/tx";

const FRAME: Record<Decision["status"], string> = {
  received: "border-line",
  processing: "border-work/40",
  paid: "border-pass/40",
  blocked: "border-block/60",
  rejected_onchain: "border-wall/60",
};

export function DecisionCard({ d }: { d: Decision }) {
  const reduce = useReducedMotion();
  const inFlight = d.status === "processing" || d.status === "received";
  const href = `/decisions/${encodeURIComponent(d.invoiceId)}`;

  return (
    <motion.article
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: -40, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={cn("group relative overflow-hidden rounded-card border bg-ink-900 hover:bg-ink-800/70", FRAME[d.status])}
      aria-labelledby={`t-${d.invoiceId}`}
    >
      {/* ticket stub header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-line px-4 py-2.5 sm:px-5">
        <StatusPill status={d.status} />
        <span className="font-mono text-xs text-fg-subtle">
          {d.invoiceId} · {formatTime(d.receivedAt)}
        </span>
      </div>

      <div className="relative px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h3 id={`t-${d.invoiceId}`} className="font-display text-2xl font-bold leading-tight sm:text-3xl">
              {/* stretched link: the whole card opens the detail */}
              <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-card focus-visible:after:outline focus-visible:after:outline-[3px] focus-visible:after:outline-pass">
                {d.status === "rejected_onchain" ? "Dirección fuera de la lista" : d.supplier.name}
              </Link>
            </h3>
            <p className="text-sm text-fg-muted">
              {d.status === "rejected_onchain"
                ? "Intento de pago directo al contrato"
                : `${countryName(d.supplier.country)} · cobra en ${d.supplier.currency}`}
            </p>
          </div>
          <Amount d={d} />
        </div>

        <div className="mt-4">
          {inFlight && <StepTracker steps={displaySteps(d)} />}
          {isAwaitingConfirmation(d) && <PendingConfirmation d={d} className="mt-3" />}

          {d.status === "blocked" && (
            <>
              <p className="max-w-[40ch] text-xl font-semibold leading-snug text-fg sm:text-2xl md:pr-40">{d.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {isCurrencyBlock(d) && (
                  <span className="inline-flex items-center gap-1.5 rounded-chip border border-block/50 bg-block-soft px-2.5 py-1 text-sm font-medium text-block-fg">
                    <Coins aria-hidden className="h-3.5 w-3.5" />
                    moneda no aceptada
                  </span>
                )}
                <SignalList signals={d.risk.signals} />
              </div>
              <Stamp text="No pasa" className="absolute bottom-4 right-4 opacity-90 max-md:!text-lg sm:right-6 md:bottom-auto md:top-1/2 md:-translate-y-1/2" />
            </>
          )}

          {d.status === "paid" && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              {d.quote && <RouteChips quote={d.quote} />}
              <TxLink d={d} />
            </div>
          )}

          {d.status === "rejected_onchain" && (
            <>
              <p className="max-w-[46ch] text-lg font-semibold leading-snug sm:text-xl">
                Alguien intentó pagar {formatMoney(d.amount.value, d.amount.currency)} a una dirección fuera de la lista. El contrato dijo que no.
              </p>
              <TxLink d={d} className="mt-1" />
              <Stamp text="El contrato dijo que no" tone="wall" className="absolute bottom-5 right-4 hidden !text-xl sm:right-6 md:block" />
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function Amount({ d }: { d: Decision }) {
  const out = d.quote && d.quote.route.length > 1 ? d.quote : null;
  if (d.status === "paid" && out) {
    const target = out.route[out.route.length - 1];
    return (
      <div className="text-right tabular">
        <div className="font-display text-3xl font-bold leading-none text-pass-fg sm:text-4xl">
          <span className="text-xl text-fg-muted">{target} </span>
          {formatAmount(out.amountOut, target)}
        </div>
        <div className="mt-1 text-sm text-fg-muted">desde {formatMoney(d.amount.value, d.amount.currency)}</div>
      </div>
    );
  }
  return (
    <div className="text-right tabular">
      <div
        className={cn(
          "font-display text-3xl font-bold leading-none sm:text-4xl",
          d.status === "blocked" || d.status === "rejected_onchain" ? "text-fg-muted" : d.status === "paid" ? "text-pass-fg" : "text-fg",
        )}
      >
        <span className="text-xl text-fg-muted">{d.amount.currency} </span>
        <span className={cn((d.status === "blocked" || d.status === "rejected_onchain") && "line-through decoration-block/80 decoration-[3px]")}>
          {formatAmount(d.amount.value, d.amount.currency)}
        </span>
      </div>
      {out && d.status !== "blocked" && (
        <div className="mt-1 text-sm text-fg-muted">
          ≈ {formatMoney(out.amountOut, out.route[out.route.length - 1])}
        </div>
      )}
    </div>
  );
}
