import { Inbox } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-ink-600 bg-ink-900 px-6 py-20 text-center">
      <Inbox aria-hidden className="h-12 w-12 text-fg-subtle" />
      <p className="mt-4 max-w-[30ch] text-3xl font-semibold leading-tight">Todavía no llegó ninguna factura.</p>
      <p className="mt-2 max-w-[40ch] text-lg text-fg-muted">Mandá una a la casilla y mirá cómo trabaja.</p>
    </div>
  );
}
