# Zero Risk · Dashboard

Custom dashboard for the Zero Risk agentic agency. Path A (Tremor + shadcn
+ ReactFlow) per the operator-tool decision · NOT a fork of the mission-
control personal task manager.

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | React 19 |
| Language | TypeScript strict | shared with `zero-risk-platform` conventions |
| Styling | Tailwind CSS v4 | dark-mode default · violet/cyan accent |
| Charts | Tremor `@tremor/react` | KPIs · line/area/bar charts |
| Graphs | ReactFlow `@xyflow/react` | cascade orchestration visualization |
| UI primitives | shadcn/ui + Radix | dialog · tabs · tooltip · separator |
| Icons | Lucide React | consistent with rest of stack |
| Animation | Framer Motion | section transitions · subtle motion |
| Backend | Supabase | shared `zero-risk-platform` Pro project (read-only) |
| Hosting | Vercel | preview + prod |

## Structure

```
zero-risk-dashboard/
├── app/
│   ├── layout.tsx                  HTML shell · dark mode · fonts
│   ├── globals.css                 Tailwind v4 theme · HSL custom properties
│   ├── page.tsx                    main dashboard · bento grid
│   ├── agents/[slug]/page.tsx      cubículo agente detail (placeholder)
│   └── clients/[id]/page.tsx       carpeta cliente detail (placeholder)
├── components/
│   ├── Header.tsx                  sticky nav · Agents / Clients / Cascades
│   └── BentoCard.tsx               grid card primitive · href + accent variants
├── lib/
│   ├── supabase.ts                 getSupabaseAdmin() + getSupabaseAnon()
│   └── utils.ts                    cn() Tailwind class merger
├── __tests__/utils.test.ts         vitest sanity (5 cases)
├── .github/workflows/ci.yml        typecheck + lint + test + build
└── tailwind.config.ts · tsconfig.json · postcss.config.mjs · next.config.ts
```

## Local development

```bash
pnpm install
cp .env.example .env.local       # fill Supabase URL + service-role key
pnpm dev                          # localhost:3000
pnpm verify                       # typecheck + lint + test
pnpm build                        # production build
```

## Deployment

Vercel auto-deploys on push to `main`. Preview deploys on every PR. Set
the 4 env vars from `.env.example` in the Vercel project's
Settings → Environment Variables across production + preview + development.

## Roadmap

Phase 0 (this PR) · scaffold · placeholder cards · navigation chrome.

Phase 1 (next) · wire live data:
- `/api/agents/[slug]/stats` → Tremor charts
- `/api/clients/[id]/journey` → state machine viz
- `/api/cascades` → ReactFlow graph of the 6-agent sequence
- HITL inbox · pending approvals from `hitl_pending_approvals`

## License

AGPL-3.0. Consistent with the `mission-control` fork and the broader Zero Risk
open-source posture. Commercial use is allowed; modifications must be shared
back if the modified code is exposed over a network.
