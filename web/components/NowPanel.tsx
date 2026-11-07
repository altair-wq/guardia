"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Decision } from "@/lib/types";
import { formatMoney, formatTime } from "@/lib/format";
import { headline, toneOf, verdictWord, type Tone } from "@/lib/headline";
import { displaySteps } from "@/lib/tx";
import { cn } from "@/lib/cn";
import { StepTracker } from "./StepTracker";
import { TxLink } from "./TxLink";

const BAND: Record<Tone, string> = {
  pass: "bg-pass text-white",
  block: "bg-block text-fg",
  wall: "bg-wall text-white",
  work: "bg-ink-800 text-fg",
};

/** The one focal point of the feed: the latest decision, its verdict and one sentence of why. */
export function NowPanel({ d }: { d: Decision }) {
  const reduce = useReducedMotion();
  const tone = toneOf(d);
  const inFlight = d.status === "processing" || d.status === "received";
  const stopped = d.status === "blocked" || d.status === "rejected_onchain";
  const who = d.status === "rejected_onchain" ? "Dirección fuera de la lista" : d.supplier.name;

  return (
    <article aria-labelledby="now-verdict" className="overflow-hidden rounded-card border border-line bg-ink-900 shadow-[0_1px_2px_rgb(22_27_35/0.06)]">
      <div className={cn("flex items-end justify-between gap-4 px-5 pb-3 pt-4 transition-colors duration-500 sm:px-8 sm:pt-6", BAND[tone])}>
        <motion.p
          id="now-verdict"
          key={`${d.invoiceId}-${d.status}`}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="font-display text-[clamp(2.5rem,12vw,5.5rem)] font-extrabold uppercase leading-[0.85] tracking-tight"
        >
          {verdictWord(d)}
        </motion.p>
        <time dateTime={d.receivedAt} className="hidden pb-1 text-sm font-medium tabular opacity-80 sm:block">
          {formatTime(d.receivedAt)}
        </time>
      </div>

      <div className="px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h3 className="text-2xl font-semibold leading-tight sm:text-3xl">{who}</h3>
          <p className={cn("text-xl font-semibold tabular sm:text-2xl", stopped && "text-fg-muted line-through decoration-block decoration-2")}>
            {formatMoney(d.amount.value, d.amount.currency)}
          </p>
        </div>

        <p className="mt-4 max-w-[40ch] text-2xl leading-snug sm:text-[1.75rem]">{headline(d)}</p>

        {inFlight && (
          <div className="mt-6 max-w-xl">
            <StepTracker steps={displaySteps(d)} />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-base">
          <Link href={`/decisions/${encodeURIComponent(d.invoiceId)}`} className="font-semibold text-pass-fg underline decoration-pass/40 underline-offset-4 hover:decoration-pass">
            {stopped ? "Ver por qué" : "Ver detalle"}
          </Link>
          {d.txHash && <TxLink d={d} />}
        </div>
      </div>
    </article>
  );
}
