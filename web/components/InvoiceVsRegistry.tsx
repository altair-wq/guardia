import { Check, X } from "lucide-react";
import type { Decision, Rules, RulesSupplier } from "@/lib/types";
import { formatMoney, shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";
import { AddressZoom } from "./AddressDiff";

export function findRegistered(d: Decision, rules: Rules | null): RulesSupplier | undefined {
  if (!rules) return undefined;
  const norm = (s: string) => s.trim().toLowerCase();
  return (
    rules.suppliers.find((s) => norm(s.name) === norm(d.supplier.name)) ??
    rules.suppliers.find((s) => norm(s.wallet) === norm(d.supplier.wallet))
  );
}

interface Row {
  label: string;
  invoice: React.ReactNode;
  registry: React.ReactNode;
  ok: boolean;
}

export function InvoiceVsRegistry({ d, rules }: { d: Decision; rules: Rules | null }) {
  const reg = findRegistered(d, rules);
  const walletOk = !!reg && reg.wallet.toLowerCase() === d.supplier.wallet.toLowerCase();
  const capOk = !rules || Number(d.amount.value) <= Number(rules.perPaymentCap);

  const rows: Row[] = [
    {
      label: "Proveedor",
      invoice: d.supplier.name,
      registry: reg ? reg.name : <span className="text-block-fg">No está en la lista</span>,
      ok: !!reg,
    },
    {
      label: "Billetera",
      invoice: <span className="font-mono text-base" title={d.supplier.wallet}>{shortAddress(d.supplier.wallet, 4, 4)}</span>,
      registry: reg ? <span className="font-mono text-base" title={reg.wallet}>{shortAddress(reg.wallet, 4, 4)}</span> : "—",
      ok: walletOk,
    },
    {
      label: "Cobra en",
      invoice: d.supplier.currency,
      registry: reg ? reg.payToken : "—",
      ok: !!reg && reg.payToken === d.supplier.currency,
    },
    {
      label: "Monto",
      invoice: formatMoney(d.amount.value, d.amount.currency),
      registry: rules ? `tope por pago ${formatMoney(rules.perPaymentCap, "ARGt")}` : "—",
      ok: capOk,
    },
  ];

  return (
    <div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-left">
          <caption className="sr-only">Datos de la factura comparados con el registro del proveedor</caption>
          <thead>
            <tr className="border-b border-line text-sm text-fg-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">Dato</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Factura</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Registro</th>
              <th scope="col" className="py-2 font-semibold"><span className="sr-only">Coincide</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={cn("border-b border-line align-top", !r.ok && "bg-block-soft/50")}>
                <th scope="row" className="py-3 pr-3 text-sm font-medium text-fg-muted">{r.label}</th>
                <td className={cn("py-3 pr-3", !r.ok && "font-semibold text-block-fg")}>{r.invoice}</td>
                <td className="py-3 pr-3">{r.registry}</td>
                <td className="py-3">
                  {r.ok ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-pass-fg"><Check aria-hidden className="h-4 w-4" />coincide</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-block-fg"><X aria-hidden className="h-4 w-4" />no coincide</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reg && !walletOk && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-fg-muted">
            Mirá de cerca: empieza y termina parecido, pero no es la misma billetera ({shortAddress(d.supplier.wallet)} vs {shortAddress(reg.wallet)}).
          </p>
          <AddressZoom invoice={d.supplier.wallet} registered={reg.wallet} />
        </div>
      )}
    </div>
  );
}
