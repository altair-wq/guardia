"use client";
import Link from "next/link";
import { FlaskConical, Link2, ShieldCheck } from "lucide-react";
import { USE_FIXTURES } from "@/lib/source";
import { useSourceState } from "@/hooks/useSource";
import type { ConnectionState } from "@/lib/types";
import { LiveIndicator } from "./LiveIndicator";
import { ResetNotice } from "./ResetNotice";

const pill = "inline-flex items-center gap-1.5 text-sm font-medium";

/** Which chain the payments run on: fixtures, agent on MOCK_CHAIN, or real Arbitrum One. */
function ChainBadge() {
  const { mockChain } = useSourceState();
  if (USE_FIXTURES) {
    return (
      <span className={`${pill} text-fg-muted`}>
        <FlaskConical aria-hidden className="h-4 w-4" />
        Modo demo: datos simulados
      </span>
    );
  }
  if (mockChain === true) {
    return (
      <span className={`${pill} text-fg-muted`}>
        <FlaskConical aria-hidden className="h-4 w-4" />
        Agente real · cadena simulada
      </span>
    );
  }
  if (mockChain === false) {
    return (
      <span className={`${pill} text-fg-muted`}>
        <Link2 aria-hidden className="h-4 w-4 text-pass" />
        Onchain · Arbitrum One
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
          <ShieldCheck aria-hidden className="h-7 w-7 text-pass" />
          <span className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide">Guardia</span>
        </Link>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <ChainBadge />
          <LiveIndicator connection={connection} />
        </div>
      </div>
      <ResetNotice />
    </header>
  );
}
