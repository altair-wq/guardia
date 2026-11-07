# Guardia · dashboard (`web/`)

Read-only dashboard where the owner **watches** the agent pay suppliers and block fraud live. No approve/reject buttons, no wallet connect, no login.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind 3 + Framer Motion + lucide icons.

## Run with fixtures (no agent needed)

```bash
cd web
npm install
npm run dev            # http://localhost:3000
```

`NEXT_PUBLIC_USE_FIXTURES` defaults to `true`. The feed starts empty, then every 6 s the next decision from `shared/fixtures/decisions.json` arrives as `procesando`, its steps fill one per second, and it lands on its final status. Stats and the daily cap bar are derived from the replayed decisions.

`predev` / `prebuild` run `scripts/copy-fixtures.mjs`, which copies `shared/fixtures/*.json` into `web/fixtures/` (the originals are never edited; the committed copy is a fallback).

## Run live against the agent

```bash
cd web
NEXT_PUBLIC_USE_FIXTURES=false NEXT_PUBLIC_AGENT_URL=http://localhost:8787 npm run dev
```

Or `npm start` from the repo root (`demo/start.sh` starts agent + dashboard in live mode). The live source does `GET /decisions` + `GET /rules`, then subscribes to `GET /events` (SSE) with exponential-backoff reconnect, upserting decisions by `invoiceId` and refreshing `/rules` whenever a decision settles.

## Hidden demo shortcut

Press **R** anywhere (outside inputs): live mode calls `POST /demo/reset`; fixtures mode restarts the replay.

## Deploy (Vercel)

No `vercel.json` needed. Fixtures are committed in `web/fixtures/`; `prebuild` refreshes them from `../shared/fixtures` when that folder is visible and otherwise keeps the committed copy, so the build never needs files outside `web/`.

Public link (fixtures mode):

1. Vercel → Add New → Project → import the repo.
2. **Root Directory**: `web`. **Framework Preset**: Next.js. Leave build/install/output commands on their defaults (`npm install`, `npm run build`, `.next`).
3. Environment Variables: `NEXT_PUBLIC_USE_FIXTURES` = `true`.
4. Deploy. The header shows "Modo demo: datos simulados" and every tx shows "Transacción simulada" (no Arbiscan links).

Later, live data:

1. Start the agent and its tunnel (`agent/scripts/tunnel.sh`) and copy the `https://…` URL.
2. Project → Settings → Environment Variables: `NEXT_PUBLIC_USE_FIXTURES` = `false`, `NEXT_PUBLIC_AGENT_URL` = `<tunnel https URL>` (no trailing slash needed).
3. Deployments → Redeploy (the `NEXT_PUBLIC_*` vars are inlined at build time, so a redeploy is required after every change, including a new tunnel URL).
4. The agent's default `ALLOWED_ORIGINS` already allows `https://*.vercel.app`. The R reset from a non-local origin needs `x-guardia-key`, which the dashboard does not send: on Vercel it shows "Reset bloqueado: hace falta la clave del agente" and keeps the feed. Reset from the laptop dashboard (localhost) instead.

Checks: `npm run lint` (TypeScript check; Next 16 removed `next lint`) and `NEXT_PUBLIC_USE_FIXTURES=true npm run build`. `next/font/google` downloads fonts at build time, so the build needs internet access to fonts.googleapis.com (Vercel has it).

## How the dashboard reads agent states

- `quote.source`: `curve` → "cotizado en Curve", `direct` → "pago directo en ARGt", `mock-fixed-rate` → "cotización simulada". If `quote.referenceRate` (BRAt per ARGt) is present, a small line shows "Referencia Belo: 1 BRAt ≈ N ARGt".
- Simulated tx (fixtures mode, `mock-fixed-rate`, or a `0xf100…` fixture hash): "Transacción simulada" badge, no Arbiscan link. Real tx: "Ver en Arbiscan ↗".
- `processing` + `txHash`: "Pago enviado, esperando confirmación en la red" with a pulsing dot and the tx link; the execute step shows as running.
- Blocked for currency (reason mentions "moneda"): no conversion shown, the reason stays the headline, plus a "moneda no aceptada" chip. Paid/protected stats only add ARGt amounts.
- If refreshing `/rules` fails while the event stream is live, the dashboard keeps the last known rules and shows a warning instead of presenting stale data as current.

## Structure

| Path | What |
| --- | --- |
| `lib/types.ts` | Decision / Rules types, mirroring `SHARED_CONTRACTS.md` |
| `lib/source.ts` | `DataSource` with `FixtureSource` (replay) and `LiveSource` (REST + SSE) |
| `hooks/` | `useDecisions` (with derived stats), `useRules`, `useResetShortcut` |
| `app/page.tsx` | `/` live feed |
| `app/decisions/[invoiceId]` | Detail: step trace, Factura vs. registro (lookalike wallet diff), risk, quote/route, onchain result |
| `components/` | DecisionCard, StatusPill, SignalChip, StepTracker, RouteChips, StatTile, SupplierRow, CapBar, TxLink, Stamp, ... |
| `tailwind.config.ts` + `app/globals.css` | All colours, fonts, radii as tokens: the Figma restyle is a token swap |

## Notes for the team

- Money is formatted with `es-AR` (ARGt without decimals, other tokens with 2).
- Status is always icon + word + colour (blue = pasa, amber = no pasa). Motion respects `prefers-reduced-motion`.
- The injection detail shows the malicious line if a decision carries `injectionQuote` (not in the shared contract yet; the agent extracts it internally). Without it, a generic highlighted block is shown.
- Checked: 1280×720 and 390 px wide, no console errors, Lighthouse accessibility 100.
