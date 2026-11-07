import { cn } from "@/lib/cn";

/** Split `addr` against `ref` into matching prefix, differing middle and matching suffix (case-insensitive). */
export function splitAgainst(addr: string, ref: string) {
  const a = addr.toLowerCase();
  const b = ref.toLowerCase();
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return { head: addr.slice(0, p), mid: addr.slice(p, addr.length - s), tail: addr.slice(addr.length - s) };
}

/**
 * Renders an address with the parts that match the reference dimmed and the differing part highlighted:
 * the classic lookalike trick (same first and last characters, different middle) becomes obvious.
 */
export function AddressDiff({ addr, against, tone }: { addr: string; against?: string; tone: "bad" | "ok" }) {
  if (!against || tone === "ok") {
    return <span className="break-all font-mono text-sm sm:text-base">{addr}</span>;
  }
  const { head, mid, tail } = splitAgainst(addr, against);
  return (
    <span className="break-all font-mono text-sm sm:text-base">
      <span className="text-fg-subtle">{head}</span>
      <mark className={cn("rounded px-0.5 font-bold", "bg-block-soft text-block-fg ring-1 ring-block/40")}>{mid}</mark>
      <span className="text-fg-subtle">{tail}</span>
    </span>
  );
}

/** Zoomed short form: first 4 / last 4 characters, the part a busy human actually checks. */
export function AddressZoom({ invoice, registered }: { invoice: string; registered: string }) {
  const short = (x: string) => ({ head: x.slice(0, 6), tail: x.slice(-4) });
  const a = short(invoice);
  const b = short(registered);
  const Cell = ({ v, same }: { v: string; same: boolean }) => (
    <span className={cn("rounded px-1", same ? "text-fg-muted" : "bg-block-soft font-bold text-block-fg ring-1 ring-block/40")}>{v}</span>
  );
  return (
    <div className="grid gap-2 rounded-chip bg-ink-950 p-4 font-mono text-2xl tabular">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="w-24 font-sans text-sm font-medium text-fg-muted">Factura</span>
        <Cell v={a.head} same={a.head.toLowerCase() === b.head.toLowerCase()} />
        <span className="text-fg-subtle">…</span>
        <Cell v={a.tail} same={a.tail.toLowerCase() === b.tail.toLowerCase()} />
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="w-24 font-sans text-sm font-medium text-fg-muted">Registrada</span>
        <span className="rounded px-1 text-pass-fg">{b.head}</span>
        <span className="text-fg-subtle">…</span>
        <span className="rounded px-1 text-pass-fg">{b.tail}</span>
      </div>
    </div>
  );
}
