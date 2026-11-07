# Prompt 3: Dashboard

Open a coding-agent session in the repo root and paste everything below the line. When the Figma design is ready, give the agent a screenshot of the frame and say: "Restyle to match this. Do not change the data logic."

---

You are building the dashboard module of a hackathon project. First read `CLAUDE.md`, `SHARED_CONTRACTS.md` and `web/CLAUDE.md`. Work only inside `web/`. Stack: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, deployed on Vercel.

PRODUCT CONTEXT
An autonomous AI agent pays a small Argentine company's suppliers in Twin local stablecoins and blocks fraud on its own. The dashboard is where the owner WATCHES the agent work live. Nobody approves anything here: there are no approve/reject buttons on payments. The audience is a hackathon jury watching a 90-second live demo on a projector, so the screen must read from 5 meters away.

DATA
Use the Agent API and Decision object exactly as in `SHARED_CONTRACTS.md`. Subscribe to /events (server-sent events) for live updates. With NEXT_PUBLIC_USE_FIXTURES=true, load `shared/fixtures/decisions.json` and `shared/fixtures/rules.json` instead (copy them into `web/` at build time or import them; do not edit the originals), and replay the fixtures one by one every few seconds so the live feed animates without the agent.

SCREENS
1. Live feed (home): invoices arriving in real time. Each card shows supplier and country, amount in ARGt and in the supplier's currency, the route (ARGt -> USDT0 -> BRAt), a status pill (procesando / pagado / bloqueado / rechazado onchain), the risk signals as chips (translated to Spanish), the Spanish reason, and a link to the transaction on Arbiscan. While processing, show the step trace: extraer -> verificar -> evaluar -> ejecutar.
2. Decision detail: full step trace with timestamps, the extracted invoice fields side by side with the registered supplier data (highlight mismatches), the quote, and the onchain result.
3. Rules: suppliers table (name, country, wallet shortened, pay token), per-payment cap, daily cap with a progress bar of spent today, vault address and balance. Read-only, with a visibly disabled "Editar reglas" button labelled "solo el dueño, onchain".
4. Header stats: pagado hoy, bloqueado hoy, plata protegida (sum of blocked and rejected amounts).

DESIGN DIRECTION (placeholder until the Figma design lands)
Dark "control room": near-black background, Space Grotesk for text, JetBrains Mono for numbers and hashes, blue for paid, orange for blocked (never red/green alone), large type. Blocked cards make the reason the most visible text; paid cards are calm with the tx link.

RULES
- Spanish (rioplatense) UI copy, English code.
- The newest decision animates in at the top.
- Works at 1280x720 (projector) and on a phone.
- No wallet-connect, no login: read-only dashboard.

DELIVERABLES
- Pages for the 3 screens, components per card type, a typed API client generated from the shared types
- `web/README.md`: how to run with fixtures and with the live agent (NEXT_PUBLIC_AGENT_URL), how to deploy to Vercel. Commit after each working step.
