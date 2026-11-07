"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Ban, CheckCircle2, Loader2, ShieldX } from "lucide-react";
import type { Decision } from "@/lib/types";
import { countryName, formatAmount, formatTime } from "@/lib/format";
import { headline, toneOf, verdictWord, type Tone } from "@/lib/headline";
import { displaySteps, fxSnapshot } from "@/lib/tx";
import { Money } from "./TokenBadge";
import { cn } from "@/lib/cn";
import { StepTracker } from "./StepTracker";
import { CheckList } from "./CheckList";
import { checksFor } from "@/lib/checks";
import { TxLink } from "./TxLink";

const BAND: Record<Tone, string> = {
  pass: "bg-pass-soft text-pass-fg",
  block: "bg-block-soft text-block-fg",
  wall: "bg-wall-soft text-wall",
  work: "bg-work-soft text-brand",
};
const ICON = { pass: CheckCircle2, block: Ban, wall: ShieldX, work: Loader2 } as const;

/**
 * The verdict card: the feed's single focal point, and the header of the detail page.
 * `full` shows the agent's complete reason instead of the one-line headline.
 */
export function NowPanel({ d, full = false }: { d: Decision; full?: boolean }) {
  const reduce = useReducedMotion();
  const tone = toneOf(d);
  const Icon = ICON[tone];
  const inFlight = d.status === "processing" || d.status === "received";
  const stopped = d.status === "blocked" || d.status === "rejected_onchain";
  const who = d.status === "rejected_onchain" ? "Dirección fuera de la lista" : d.supplier.name;
  const sub =
    d.status === "rejected_onchain" ? "Intento de pago directo al contrato" : `${countryName(d.supplier.country)}, cobra en ${d.supplier.currency}`;
  const Title = full ? "h1" : "h2";
  const checks = checksFor(d);
  const out = d.quote && d.quote.route.length > 1 ? d.quote : null;
  const fx = fxSnapshot(d);

  return (
    <article aria-labelledby={`v-${d.invoiceId}`} className="shadow-card overflow-hidden rounded-card border border-line bg-ink-900">
      <div className={cn("flex items-center justify-between gap-4 px-6 py-5 transition-colors duration-500 sm:px-8 sm:py-6", BAND[tone])}>
        <motion.p
          id={`v-${d.invoiceId}`}
          key={`${d.invoiceId}-${d.status}`}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex items-center gap-3 text-[clamp(2.25rem,7vw,3.75rem)] font-bold leading-none tracking-[-0.03em]"
        >
          <Icon aria-hidden strokeWidth={2.25} className={cn("h-[0.8em] w-[0.8em] shrink-0", tone === "work" && "animate-spin motion-reduce:animate-none")} />
          {verdictWord(d)}
        </motion.p>
        <time dateTime={d.receivedAt} className="hidden text-base tabular text-fg-muted sm:block">
          {formatTime(d.receivedAt)}
        </time>
      </div>

      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-2">
          <div className="min-w-0">
            <Title className="text-2xl font-semibold leading-tight tracking-[-0.01em]">{who}</Title>
            <p className="mt-1 text-base text-fg-muted">{sub}</p>
          </div>
          <div className="sm:text-right">
            <p className={cn("text-2xl font-semibold leading-tight", stopped && "text-fg-subtle")}>
              <Money value={d.amount.value} token={d.amount.currency} strike={stopped} />
            </p>
            {out && !stopped && (
              <p className="mt-1.5 flex items-center gap-1.5 text-lg text-fg-muted sm:justify-end">
                <ArrowRight aria-label="se convierte en" className="h-4 w-4" />
                <Money value={out.amountOut} token={out.route[out.route.length - 1]} />
              </p>
            )}
            {fx && !stopped && (
              <p className="mt-1 text-sm tabular text-fg-subtle">
                1 {fx.target} = {formatAmount(fx.argtPerUnit.toFixed(2), "BRAt")} ARGt, fijado a las {formatTime(fx.at)}
              </p>
            )}
          </div>
        </div>

        <p className="mt-5 max-w-[52ch] text-xl leading-relaxed text-fg">{full ? d.reason : headline(d)}</p>

        {checks && (
          <div className="mt-5">
            <CheckList checks={checks} />
          </div>
        )}

        {inFlight && (
          <div className="mt-6 max-w-xl">
            <StepTracker steps={displaySteps(d)} />
          </div>
        )}

        {(!full || d.txHash) && (
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-5">
            {!full && (
              <Link
                href={`/decisions/${encodeURIComponent(d.invoiceId)}`}
                className="text-base font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
              >
                {stopped ? "Ver por qué" : "Ver detalle"}
              </Link>
            )}
            {d.txHash && <TxLink d={d} />}
          </div>
        )}
      </div>
    </article>
  );
}
