import { cn } from "@/lib/cn";

export function StatTile({
  label,
  unit,
  children,
  tone = "neutral",
  icon,
}: {
  label: string;
  unit?: string;
  children: React.ReactNode;
  tone?: "pass" | "block" | "neutral";
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-card border bg-ink-900 px-4 py-3 sm:px-5 sm:py-4",
        tone === "pass" && "border-pass/40",
        tone === "block" && "border-block/50",
        tone === "neutral" && "border-line",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2 font-display font-bold tabular leading-none">
        {unit && <span className="text-xl text-fg-muted sm:text-2xl">{unit}</span>}
        <span
          className={cn(
            "truncate text-4xl sm:text-5xl",
            tone === "pass" && "text-pass-fg",
            tone === "block" && "text-block-fg",
          )}
        >
          {children}
        </span>
      </div>
    </div>
  );
}
