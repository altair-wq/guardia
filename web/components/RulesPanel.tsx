"use client";
import { Lock } from "lucide-react";
import type { Rules } from "@/lib/types";
import { formatMoney, shortAddress } from "@/lib/format";
import { CapBar } from "./CapBar";
import { SupplierRow } from "./SupplierRow";

export function RulesPanel({ rules, error }: { rules: Rules | null; error: string | null }) {
  return (
    <section aria-label="Reglas del dueño" className="p-5">
      <p className="max-w-[60ch] text-base text-fg-muted">
        Viven en el contrato PolicyVault. Aunque alguien engañe a la IA, la plata no sale fuera de estas reglas.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-chip border border-block/50 bg-block-soft px-3 py-2 text-sm text-block-fg">
          {rules ? "No se pudieron actualizar las reglas. Se muestran los últimos datos recibidos." : "No se pudieron cargar las reglas."}
          <span className="mt-1 block text-xs">{error}</span>
        </p>
      )}

      {!rules && !error ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          <div className="h-10 animate-pulse rounded bg-ink-800" />
          <div className="h-16 animate-pulse rounded bg-ink-800" />
          <div className="h-32 animate-pulse rounded bg-ink-800" />
        </div>
      ) : rules ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-chip bg-ink-800 px-3 py-2">
              <dt className="text-sm font-medium text-fg-muted">Saldo del vault</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular">{formatMoney(rules.balance.value, rules.balance.currency)}</dd>
            </div>
            <div className="rounded-chip bg-ink-800 px-3 py-2">
              <dt className="text-sm font-medium text-fg-muted">Tope por pago</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular">{formatMoney(rules.perPaymentCap, "ARGt")}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <CapBar label="Tope diario" used={Number(rules.spentToday)} cap={Number(rules.dailyCap)} currency="ARGt" />
          </div>

          <h3 className="mt-5 text-lg font-semibold">
            Proveedores habilitados <span className="text-base font-normal text-fg-muted">({rules.suppliers.length})</span>
          </h3>
          <ul className="divide-y divide-line">
            {rules.suppliers.map((s) => (
              <SupplierRow key={s.wallet} s={s} />
            ))}
          </ul>

          <p className="mt-3 font-mono text-xs text-fg-subtle">
            Vault {shortAddress(rules.vault)} · {rules.chain === "arbitrum" ? "Arbitrum One" : rules.chain}
          </p>
        </>
      ) : null}

      <button
        type="button"
        disabled
        aria-disabled="true"
        className="mt-4 flex min-h-[44px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-chip border border-line bg-ink-800 px-3 text-sm font-semibold text-fg-muted"
      >
        <Lock aria-hidden className="h-4 w-4" />
        Editar reglas · solo el dueño, onchain
      </button>
    </section>
  );
}
