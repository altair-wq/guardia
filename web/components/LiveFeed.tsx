"use client";
import { ChevronDown } from "lucide-react";
import { useDecisions } from "@/hooks/useDecisions";
import { useRules } from "@/hooks/useRules";
import { useResetShortcut } from "@/hooks/useResetShortcut";
import { formatMoney } from "@/lib/format";
import type { Stats } from "@/lib/stats";
import { EmptyState } from "./EmptyState";
import { Header } from "./Header";
import { HistoryRow } from "./HistoryRow";
import { NowPanel } from "./NowPanel";
import { RulesPanel } from "./RulesPanel";

function TodaySentence({ stats }: { stats: Stats }) {
  const paid = stats.paidToday > 0 ? `pagó ${formatMoney(stats.paidToday, "ARGt")}` : "todavía no pagó nada";
  const n = stats.blockedCount;
  const blocked =
    n === 0
      ? "no frenó ningún intento"
      : `frenó ${n} ${n === 1 ? "intento" : "intentos"}${stats.protectedAmount > 0 ? ` por ${formatMoney(stats.protectedAmount, "ARGt")}` : ""}`;
  return (
    <p className="text-lg text-fg-muted">
      Hoy el agente <span className="font-semibold text-fg">{paid}</span> y <span className="font-semibold text-fg">{blocked}</span>.
    </p>
  );
}

export function LiveFeed() {
  const { decisions, stats, connection, error, rulesError } = useDecisions();
  const rules = useRules();
  useResetShortcut();
  const [now, ...earlier] = decisions;

  return (
    <>
      <Header connection={connection} />
      <main className="mx-auto max-w-[920px] px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
        <h1 className="sr-only">Guardia: pagos a proveedores en vivo</h1>

        {error && connection !== "live" && (
          <p role="alert" className="mb-6 rounded-chip border border-block/60 bg-block-soft px-4 py-3 text-base text-block-fg">
            No hay conexión con el agente ({error}). Reintento solo.
          </p>
        )}

        <section aria-label="Última factura" aria-live="polite">
          {now ? <NowPanel d={now} /> : <EmptyState />}
        </section>

        {decisions.length > 0 && (
          <div className="mt-8">
            <TodaySentence stats={stats} />
          </div>
        )}

        {earlier.length > 0 && (
          <section aria-labelledby="earlier-title" className="mt-8">
            <h2 id="earlier-title" className="mb-3 text-base font-semibold text-fg-muted">
              Antes
            </h2>
            <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-ink-900">
              {earlier.map((d) => (
                <li key={d.invoiceId}>
                  <HistoryRow d={d} />
                </li>
              ))}
            </ol>
          </section>
        )}

        <details className="group mt-10 rounded-card border border-line bg-ink-900">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-lg font-semibold">Reglas del dueño en el contrato</span>
              <span className="block text-base text-fg-muted">
                {rules
                  ? `Hasta ${formatMoney(rules.perPaymentCap, "ARGt")} por pago, solo a ${rules.suppliers.length} proveedores de la lista.`
                  : "Cargando reglas…"}
              </span>
            </span>
            <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-line">
            <RulesPanel rules={rules} error={rulesError} />
          </div>
        </details>
      </main>
    </>
  );
}
