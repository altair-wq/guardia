"use client";
import { useSourceState } from "./useSource";

export function useRules() {
  return useSourceState().rules;
}
