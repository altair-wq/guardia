# Guardia: rules for every coding agent

Hackathon project (HackaTwin, Buenos Aires, Nov 7 2026). Submission closes 17:30.

Guardia is an autonomous AI agent that pays a small Argentine company's suppliers in Twin local stablecoins (ARGt to BRAt via Curve) and blocks fraud on its own, with the owner's rules enforced by a smart contract (PolicyVault). No human in the loop.

## Before you write any code
1. Read `SHARED_CONTRACTS.md`. It is the only interface between modules.
2. Read the `CLAUDE.md` inside the module folder you were assigned.

## Hard rules
- Work ONLY inside your assigned folder (`contracts/`, `agent/`, `web/` or `demo/`). Do not edit other modules.
- Never change `SHARED_CONTRACTS.md` or `shared/` on your own. If you need a change, stop and tell the human.
- Never commit secrets. Use `.env` (gitignored) and keep `.env.example` updated.
- Small commits with clear messages; the judges check that the history shows work done today.
- Prefer working with mocks over waiting for another module.
- Spanish (rioplatense) for user-facing copy; English for code and comments.

## Module map
| Folder | What | Prompt |
| --- | --- | --- |
| (Figma, not code) | UI/UX design in Figma Make, handed to `web/` | `prompts/00-figma-design.md` |
| `contracts/` | PolicyVault (Foundry, Arbitrum) | `prompts/01-contract.md` |
| `agent/` | Autonomous agent service (Node + TS) | `prompts/02-agent.md` |
| `web/` | Dashboard (Next.js, Vercel) | `prompts/03-web.md` |
| `demo/` | Demo invoices, run script, README polish | `prompts/04-integration.md` |
| (pitch, not code) | Deck, script and jury Q&A | `prompts/05-pitch.md` |
| `shared/` | Decision schema + fixtures (read-only for agents) | - |
