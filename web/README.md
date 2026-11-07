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

1. Import the repo in Vercel, set **Root Directory** to `web`. Framework preset: Next.js.
2. Env vars: `NEXT_PUBLIC_USE_FIXTURES=true` for the fixtures deploy. For live, set `NEXT_PUBLIC_USE_FIXTURES=false` and `NEXT_PUBLIC_AGENT_URL=https://<public tunnel to the agent>` (the agent already enables CORS) and redeploy (these are build-time vars).

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
