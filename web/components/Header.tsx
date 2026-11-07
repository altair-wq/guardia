import Link from "next/link";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { USE_FIXTURES } from "@/lib/source";
import type { ConnectionState } from "@/lib/types";
import { LiveIndicator } from "./LiveIndicator";

export function Header({ connection }: { connection: ConnectionState }) {
  return (
    <header className="border-b border-line">
      {/* thin filete-inspired rule */}
      <div aria-hidden className="h-1 bg-[repeating-linear-gradient(90deg,rgb(var(--pass))_0_18px,transparent_18px_24px,rgb(var(--block))_24px_30px,transparent_30px_36px)] opacity-70" />
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 rounded-chip">
          <ShieldCheck aria-hidden className="h-9 w-9 text-pass" />
          <span>
            <span className="block font-display text-4xl font-extrabold uppercase leading-none tracking-wide">Guardia</span>
            <span className="block text-sm text-fg-muted">Agente de pagos autónomo</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {USE_FIXTURES && (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-dashed border-fg-subtle/70 px-3 py-1 text-sm font-semibold text-fg-muted">
              <FlaskConical aria-hidden className="h-4 w-4" />
              Modo demo: datos simulados
            </span>
          )}
          <LiveIndicator connection={connection} />
        </div>
      </div>
    </header>
  );
}
