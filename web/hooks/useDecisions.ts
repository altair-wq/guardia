"use client";
import { useMemo } from "react";
import { deriveStats } from "@/lib/stats";
import { useSourceState } from "./useSource";

export function useDecisions() {
  const { decisions, connection, error, rulesError, notice, mockChain } = useSourceState();
  const stats = useMemo(() => deriveStats(decisions), [decisions]);
  return { decisions, stats, connection, error, rulesError, notice, mockChain };
}
