"use client";
import { useEffect } from "react";
import { getSource } from "@/lib/source";

/** Hidden demo shortcut: R resets the agent (live) or restarts the replay (fixtures). */
export function useResetShortcut(onReset?: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "r" && e.key !== "R") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      void getSource()
        .reset()
        .then(() => onReset?.())
        .catch((err) => console.warn("[guardia] reset failed", err));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onReset]);
}
