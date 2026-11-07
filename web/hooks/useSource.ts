"use client";
import { useEffect, useSyncExternalStore } from "react";
import { getSource, type SourceState } from "@/lib/source";

const SERVER_STATE: SourceState = {
  decisions: [],
  rules: null,
  rulesError: null,
  connection: "connecting",
  error: null,
  notice: null,
  mockChain: null,
};

export function useSourceState(): SourceState {
  const source = getSource();
  useEffect(() => source.start(), [source]);
  return useSyncExternalStore(
    (l) => source.subscribe(l),
    () => source.getState(),
    () => SERVER_STATE,
  );
}
