"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, ShieldAlert } from "lucide-react";
import type { Decision } from "@/lib/types";
import { getSource } from "@/lib/source";
import { useSourceState } from "@/hooks/useSource";
import { useResetShortcut } from "@/hooks/useResetShortcut";
import { countryName, formatAmount, formatMoney, formatTime } from "@/lib/format";
import { REJECT_REASON_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { Header } from "./Header";
import { StatusPill } from "./StatusPill";
import { StepTrace } from "./StepTrace";
import { RouteChips } from "./RouteChips";
import { TxLink } from "./TxLink";
import { RiskScore } from "./RiskScore";
import { InvoiceVsRegistry } from "./InvoiceVsRegistry";
import { InjectionBlock } from "./InjectionBlock";
import { Stamp } from "./Stamp";

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  const id = `p-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className={cn("rounded-card border border-line bg-ink-900 p-4 sm:p-5", className)}>
      <h2 id={id} className="mb-3 font-display text-xl font-bold uppercase tracking-wide">{title}</h2>
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
      <Header connection={connection} />
      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-5 sm:px-6">
        <Link href="/" className="inline-flex min-h-[44px] items-center gap-2 rounded-chip font-semibold text-fg-muted hover:text-fg">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Volver al feed
        </Link>

        {!d ? (
          <div className="mt-6 rounded-card border border-dashed border-line p-10 text-center">
            <h1 className="font-display text-3xl font-bold">{fetched === undefined ? "Buscando la factura…" : "No encontré esa factura."}</h1>
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
  const out = d.quote && d.quote.route.length > 1 ? d.quote : null;
  const rejectCode = Object.keys(REJECT_REASON_LABEL).find((k) => d.reason.includes(k));

  return (
    <>
      <div className="relative mt-3 overflow-hidden rounded-card border border-line bg-ink-900 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={d.status} size="lg" />
          <span className="font-mono text-sm text-fg-muted">
            {d.invoiceId} · recibida {formatTime(d.receivedAt)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-none sm:text-5xl">{d.supplier.name}</h1>
            <p className="mt-1 text-fg-muted">
              {countryName(d.supplier.country)} · cobra en {d.supplier.currency}
            </p>
          </div>
          <div className="text-right font-display font-bold tabular">
            <div className="text-4xl leading-none sm:text-5xl">
              <span className="text-2xl text-fg-muted">{d.amount.currency} </span>
              {formatAmount(d.amount.value, d.amount.currency)}
            </div>
            {out && <div className="mt-1 text-xl text-fg-muted">≈ {formatMoney(out.amountOut, out.route[out.route.length - 1])}</div>}
          </div>
        </div>
        <p className="mt-4 max-w-[60ch] text-xl font-semibold leading-snug sm:text-2xl">{d.reason}</p>
        {d.status === "blocked" && <Stamp text="No pasa" className="absolute right-6 top-6 hidden md:block" />}
        {d.status === "rejected_onchain" && <Stamp text="Rechazado onchain" tone="wall" className="absolute right-6 top-6 hidden md:block" />}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {injection && <InjectionBlock d={d} />}
          <Panel title="Factura vs. registro">
            <InvoiceVsRegistry d={d} rules={rules} />
          </Panel>
          <Panel title="Riesgo">
            <RiskScore risk={d.risk} />
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Lo que hizo el agente">
            <StepTrace steps={d.steps} />
          </Panel>

          <Panel title="Cotización y ruta">
            {d.quote ? (
              <div className="space-y-3">
                <RouteChips quote={d.quote} />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-fg-muted">Recibe el proveedor</dt>
                    <dd className="font-mono text-lg tabular">{formatMoney(d.quote.amountOut, d.quote.route[d.quote.route.length - 1])}</dd>
                  </div>
                  {d.quote.minAmountOut && (
                    <div>
                      <dt className="text-fg-muted">Mínimo aceptado</dt>
                      <dd className="font-mono text-lg tabular">{formatMoney(d.quote.minAmountOut, d.quote.route[d.quote.route.length - 1])}</dd>
                    </div>
                  )}
                </dl>
              </div>
            ) : (
              <p className="text-fg-muted">Sin cotización: el agente no llegó a pedir precio porque frenó antes.</p>
            )}
          </Panel>

          <Panel title="Resultado onchain">
            {d.status === "paid" && (
              <p className="flex items-center gap-2 text-lg font-semibold text-pass-fg">
                <CheckCircle2 aria-hidden className="h-5 w-5" /> Pagado por PolicyVault en Arbitrum.
              </p>
            )}
            {d.status === "rejected_onchain" && (
              <p className="flex items-center gap-2 text-lg font-semibold text-block-fg">
                <ShieldAlert aria-hidden className="h-5 w-5" /> El contrato rechazó el pago{rejectCode ? `: ${REJECT_REASON_LABEL[rejectCode]}` : ""}. No se movió nada.
              </p>
            )}
            {d.status === "blocked" && (
              <p className="flex items-center gap-2 text-lg font-semibold text-block-fg">
                <Ban aria-hidden className="h-5 w-5" /> No se ejecutó. {executed?.status === "failed" ? "La llamada al contrato falló y no se movió nada." : "Nunca llegó al contrato."}
              </p>
            )}
            {(d.status === "processing" || d.status === "received") && <p className="text-fg-muted">Todavía no llegó al contrato.</p>}
            <TxLink href={d.explorerUrl} hash={d.txHash} className="mt-2" />
          </Panel>
        </div>
      </div>
    </>
  );
}
