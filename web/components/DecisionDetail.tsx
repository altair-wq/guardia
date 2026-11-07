"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, ShieldAlert } from "lucide-react";
import type { Decision } from "@/lib/types";
import { getSource } from "@/lib/source";
import { useSourceState } from "@/hooks/useSource";
import { useResetShortcut } from "@/hooks/useResetShortcut";
import { formatMoney } from "@/lib/format";
import { REJECT_REASON_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { Header } from "./Header";
import { StepTrace } from "./StepTrace";
import { RouteChips } from "./RouteChips";
import { NowPanel } from "./NowPanel";
import { TxLink } from "./TxLink";
import { RiskScore } from "./RiskScore";
import { InvoiceVsRegistry } from "./InvoiceVsRegistry";
import { InjectionBlock } from "./InjectionBlock";
import { PendingConfirmation } from "./PendingConfirmation";
import { displaySteps, isAwaitingConfirmation } from "@/lib/tx";

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  const id = `p-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className={cn("rounded-card border border-line bg-ink-900 p-6", className)}>
      <h2 id={id} className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function DecisionDetail({ invoiceId }: { invoiceId: string }) {
  const { decisions, rules, connection } = useSourceState();
  const live = decisions.find((d) => d.invoiceId === invoiceId);
  const [fetched, setFetched] = useState<Decision | null | undefined>(undefined);
  useResetShortcut();

  useEffect(() => {
    let alive = true;
    getSource()
      .getDecision(invoiceId)
      .then((d) => alive && setFetched(d))
      .catch(() => alive && setFetched(null));
    return () => {
      alive = false;
    };
  }, [invoiceId]);

  const d = live ?? fetched ?? null;

  return (
    <>
      <Header connection={connection} wide />
      <main className="mx-auto max-w-[1180px] px-4 pb-20 pt-6 sm:px-6">
        <Link href="/" className="-ml-1 inline-flex min-h-[44px] items-center gap-2 rounded-chip px-1 text-base font-medium text-fg-muted hover:text-fg">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Volver
        </Link>

        {!d ? (
          <div className="mt-6 rounded-card border border-dashed border-line p-10 text-center">
            <h1 className="text-2xl font-semibold">{fetched === undefined ? "Buscando la factura…" : "No encontré esa factura."}</h1>
            {fetched === null && <p className="mt-2 text-fg-muted">Puede que el demo se haya reiniciado. Volvé al feed.</p>}
          </div>
        ) : (
          <Detail d={d} rules={rules} />
        )}
      </main>
    </>
  );
}

function Detail({ d, rules }: { d: Decision; rules: ReturnType<typeof useSourceState>["rules"] }) {
  const injection = d.risk.signals.includes("prompt_injection");
  const executed = d.steps.find((s) => s.name === "execute");
  const rejectCode = Object.keys(REJECT_REASON_LABEL).find((k) => d.reason.includes(k));
  const target = d.quote ? d.quote.route[d.quote.route.length - 1] : null;

  return (
    <>
      <div className="mt-2">
        <NowPanel d={d} full />
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {injection && <InjectionBlock d={d} />}
          <Panel title="Factura contra registro">
            <InvoiceVsRegistry d={d} rules={rules} />
          </Panel>
          <Panel title="Lo que hizo el agente">
            <StepTrace steps={displaySteps(d)} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Riesgo">
            <RiskScore risk={d.risk} />
          </Panel>

          <Panel title="Pago">
            {d.quote && target ? (
              <dl className="space-y-3">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-base text-fg-muted">Recibe el proveedor</dt>
                  <dd className="text-lg font-semibold tabular">{formatMoney(d.quote.amountOut, target)}</dd>
                </div>
                {d.quote.minAmountOut && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-base text-fg-muted">Mínimo aceptado</dt>
                    <dd className="text-base tabular">{formatMoney(d.quote.minAmountOut, target)}</dd>
                  </div>
                )}
                <div className="pt-1">
                  <RouteChips quote={d.quote} />
                </div>
              </dl>
            ) : (
              <p className="text-base text-fg-muted">Sin cotización: el agente frenó antes de pedir precio.</p>
            )}

            <div className="mt-5 border-t border-line pt-5">
              {d.status === "paid" && (
                <p className="flex items-start gap-2 text-base font-semibold text-pass-fg">
                  <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0" /> Pagado por PolicyVault en Arbitrum.
                </p>
              )}
              {d.status === "rejected_onchain" && (
                <p className="flex items-start gap-2 text-base font-semibold text-wall">
                  <ShieldAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0" /> El contrato rechazó el pago{rejectCode ? `: ${REJECT_REASON_LABEL[rejectCode]}` : ""}. No se movió nada.
                </p>
              )}
              {d.status === "blocked" && (
                <p className="flex items-start gap-2 text-base font-semibold text-block-fg">
                  <Ban aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
                  {executed?.status === "failed" ? "La llamada al contrato falló. No se movió nada." : "No llegó al contrato. No se movió nada."}
                </p>
              )}
              {isAwaitingConfirmation(d) ? (
                <PendingConfirmation d={d} />
              ) : (
                (d.status === "processing" || d.status === "received") && <p className="text-base text-fg-muted">Todavía no llegó al contrato.</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
