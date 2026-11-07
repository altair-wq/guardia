import { Inbox } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-ink-900/60 px-6 py-16 text-center">
      <Inbox aria-hidden className="h-12 w-12 text-fg-subtle" />
      <p className="mt-4 max-w-[30ch] font-display text-3xl font-bold leading-tight">Todavía no llegó ninguna factura.</p>
      <p className="mt-2 max-w-[40ch] text-lg text-fg-muted">Mandá una a la casilla y mirá cómo trabaja.</p>
    </div>
  );
}
