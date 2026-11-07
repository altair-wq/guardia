"use client";
import Link from "next/link";
import { Link2, ShieldCheck, Zap } from "lucide-react";
import { USE_FIXTURES } from "@/lib/source";
import { useSourceState } from "@/hooks/useSource";
import type { ConnectionState } from "@/lib/types";
import { LiveIndicator } from "./LiveIndicator";
import { ResetNotice } from "./ResetNotice";

const pill = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold";
const simPill = `${pill} border border-sim/30 bg-sim-soft text-sim bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(var(--sim)/0.06)_6px_12px)]`;

/** Which chain the payments run on: fixtures, agent on MOCK_CHAIN, or real Arbitrum One. */
function ChainBadge() {
  const { mockChain } = useSourceState();
  if (USE_FIXTURES) {
    return (
      <span className={simPill}>
        <Zap aria-hidden className="h-4 w-4" />
        Modo demo: datos simulados
      </span>
    );
  }
  if (mockChain === true) {
    return (
      <span className={simPill}>
        <Zap aria-hidden className="h-4 w-4" />
        Agente real, cadena simulada
      </span>
    );
  }
  if (mockChain === false) {
    return (
      <span className={`${pill} bg-sky-50 text-sky-800 ring-1 ring-sky-200`}>
        <Link2 aria-hidden className="h-4 w-4 text-sky" />
        Onchain en Arbitrum One
      </span>
    );
  }
  return null;
}

export function Header({ connection, wide = false }: { connection: ConnectionState; wide?: boolean }) {
  return (
    <header className="border-b border-line bg-ink-900">
      <div className={`mx-auto flex ${wide ? "max-w-[1180px]" : "max-w-[920px]"} flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6`}>
        <Link href="/" className="flex items-center gap-3 rounded-chip">
          <ShieldCheck aria-hidden strokeWidth={2.25} className="h-7 w-7 text-brand" />
          <span className="text-2xl font-bold leading-none tracking-[-0.02em]">Guardia</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <ChainBadge />
          <LiveIndicator connection={connection} />
        </div>
      </div>
      <ResetNotice />
    </header>
  );
}
