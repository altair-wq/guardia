"use client";
import { useMemo } from "react";
import { deriveStats } from "@/lib/stats";
import { useSourceState } from "./useSource";

export function useDecisions() {
  const { decisions, connection, error, notice } = useSourceState();
  const stats = useMemo(() => deriveStats(decisions), [decisions]);
  return { decisions, stats, connection, error, notice };
}
