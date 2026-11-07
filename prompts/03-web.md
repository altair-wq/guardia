# Prompt 3: Dashboard (implements the Figma design)

Open a coding-agent session in the repo root and paste everything below the line. Until the Figma frames arrive, the agent builds on the placeholder direction; when they arrive, send the PNG exports (and the Figma link if your agent has Figma Dev Mode / MCP access) with: "Restyle to match these frames exactly. Do not change the data logic."

---

You are the frontend engineer of a hackathon team. First read `CLAUDE.md`, `SHARED_CONTRACTS.md`, `web/CLAUDE.md` and `prompts/00-figma-design.md` (it describes the screens, copy, components and motion the designer is producing). Work only inside `web/`. Stack: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui primitives + Framer Motion, deployed on Vercel. Commit after every working step.

## Product context
An autonomous AI agent pays a small Argentine company's suppliers in Twin local stablecoins and blocks fraud on its own. The dashboard is where the owner WATCHES the agent work live. Nobody approves anything: no approve/reject buttons anywhere. The jury watches a 90-second live demo on a projector, so it must read from 5 meters away and feel like a real fintech product, not a template.

## Architecture (build this first, before any styling)
- `lib/types.ts`: TypeScript types for Decision, Rules and the API, mirroring `SHARED_CONTRACTS.md` and `shared/decision.schema.json`.
- `lib/source.ts`: one data source interface with two implementations:
  - `FixtureSource` (NEXT_PUBLIC_USE_FIXTURES=true): imports `shared/fixtures/decisions.json` and `rules.json` (copied into `web/fixtures/` by a prebuild script; never edit the originals) and REPLAYS them: start empty, then every 6 s push the next decision as `processing`, advance its steps one by one every second, then set its final status. This makes the feed come alive with no agent.
  - `LiveSource`: GET /decisions and /rules, then subscribe to /events (EventSource) with auto-reconnect; upsert decisions by `invoiceId`.
- `hooks/useDecisions.ts` and `hooks/useRules.ts` on top of the source. Stats (pagado hoy, bloqueado hoy, plata protegida) are derived from decisions, never hardcoded.
- A hidden keyboard shortcut `R` calls POST /demo/reset (live) or restarts the replay (fixtures) so we can rerun the demo.

## Screens (copy and states as in `prompts/00-figma-design.md`)
1. `/` Live feed: header with live indicator, 3 stat tiles, decision cards newest first, side panel with the owner's rules (caps, daily progress, allowlisted suppliers, vault balance, disabled "Editar reglas · solo el dueño, onchain").
2. `/decisions/[invoiceId]` Detail: step trace with timestamps, "Factura vs. registro" table with mismatches highlighted (for lookalike wallets, render the address with the matching first/last 4 characters dimmed and the differing middle highlighted), risk score, quote and route, onchain result with explorer link. For prompt-injection decisions show the quoted malicious line in a highlighted block.
3. Empty state: "Todavía no llegó ninguna factura. Mandá una a la casilla y mirá cómo trabaja."

## Components (match the Figma variants)
DecisionCard (received, processing, paid, blocked, rejected_onchain), StatusPill, SignalChip (translate signals: wallet_changed "billetera cambiada", lookalike_address "dirección parecida", unknown_supplier "proveedor desconocido", amount_anomaly "monto inusual", urgent_language "lenguaje urgente", prompt_injection "inyección de prompt", website_mismatch "web no coincide"), StepTracker, RouteChips, StatTile, SupplierRow, CapBar, TxLink. Format money with `es-AR` locale (thousands with dots, decimals with comma).

## Motion
New card slides in from the top (Framer Motion layout animation); a blocked card gets a stamp animation; step tracker fills progressively; "Plata protegida" counts up. Respect `prefers-reduced-motion`.

## Placeholder style until Figma lands
Dark: near-black blue-tinted background, bold condensed grotesk for headings and big numbers, clean sans for body, monospace for hashes; blue for paid, amber for blocked; status always icon + word + colour. Put all colours, fonts and radii in Tailwind theme tokens so the Figma restyle is a token swap plus component tweaks, not a rewrite.

## Quality bar
Readable at 1280 x 720 (projector) and 390 px wide (phone). Text contrast 4.5:1. Real buttons and links, keyboard focus visible. No console errors. Lighthouse accessibility >= 90.

## Deliverables
- The pages and components above, the two data sources, the replay
- Deployed on Vercel (fixtures mode first, live mode once the agent has a public URL, e.g. via a tunnel)
- `web/README.md`: run with fixtures, run live (NEXT_PUBLIC_AGENT_URL), deploy, the `R` reset shortcut
