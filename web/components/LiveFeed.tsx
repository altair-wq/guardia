"use client";
import { AnimatePresence } from "framer-motion";
import { Ban, CheckCircle2, ShieldCheck } from "lucide-react";
import { useDecisions } from "@/hooks/useDecisions";
import { useRules } from "@/hooks/useRules";
import { useResetShortcut } from "@/hooks/useResetShortcut";
import { formatAmount } from "@/lib/format";
import { CountUp } from "./CountUp";
import { DecisionCard } from "./DecisionCard";
import { EmptyState } from "./EmptyState";
import { Header } from "./Header";
import { RulesPanel } from "./RulesPanel";
import { StatTile } from "./StatTile";

const fmtArgt = (n: number) => formatAmount(n, "ARGt");

export function LiveFeed() {
  const { decisions, stats, connection, error, rulesError } = useDecisions();
  const rules = useRules();
  useResetShortcut();

  return (
    <>
      <Header connection={connection} />
      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-5 sm:px-6">
        <h1 className="sr-only">Guardia: pagos a proveedores en vivo</h1>

        <section aria-label="Resumen de hoy" className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
          <div className="min-w-[78%] snap-start sm:min-w-0">
            <StatTile label="Pagado hoy" unit="ARGt" tone="pass" icon={<CheckCircle2 aria-hidden className="h-4 w-4 text-pass" />}>
              <CountUp value={stats.paidToday} format={fmtArgt} />
            </StatTile>
          </div>
          <div className="min-w-[78%] snap-start sm:min-w-0">
            <StatTile label="Bloqueado hoy" tone="block" icon={<Ban aria-hidden className="h-4 w-4 text-block" />}>
              {stats.blockedCount} <span className="text-2xl text-fg-muted">{stats.blockedCount === 1 ? "intento" : "intentos"}</span>
            </StatTile>
          </div>
          <div className="min-w-[78%] snap-start sm:min-w-0">
            <StatTile label="Plata protegida" unit="ARGt" tone="block" icon={<ShieldCheck aria-hidden className="h-4 w-4 text-block" />}>
              <CountUp value={stats.protectedAmount} format={fmtArgt} />
            </StatTile>
          </div>
        </section>

        {error && connection !== "live" && (
          <p role="alert" className="mt-4 rounded-chip border border-block/50 bg-block-soft px-3 py-2 text-sm text-block-fg">
            No pude hablar con el agente ({error}). Reintento solo.
          </p>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="feed-title">
            <h2 id="feed-title" className="mb-3 font-display text-xl font-bold uppercase tracking-wide text-fg-muted">
              Lo que está haciendo el agente
            </h2>
            {decisions.length === 0 ? (
              <EmptyState />
            ) : (
              <ol className="space-y-3" aria-live="polite" aria-relevant="additions">
                <AnimatePresence initial={false}>
                  {decisions.map((d) => (
                    <li key={d.invoiceId}>
                      <DecisionCard d={d} />
                    </li>
                  ))}
                </AnimatePresence>
              </ol>
            )}
          </section>
          <aside className="lg:sticky lg:top-5 lg:self-start">
            <RulesPanel rules={rules} error={rulesError} />
          </aside>
        </div>
      </main>
    </>
  );
}
