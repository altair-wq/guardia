"use client";
import { useSourceState } from "@/hooks/useSource";

/** Small toast for the presenter, e.g. when POST /demo/reset is refused (401/403). */
export function ResetNotice() {
  const { notice } = useSourceState();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {notice && (
        <p className="max-w-md rounded-chip border border-block/60 bg-ink-800 px-4 py-3 text-center text-sm font-semibold text-block-fg shadow-lg">
          {notice}
        </p>
      )}
    </div>
  );
}
