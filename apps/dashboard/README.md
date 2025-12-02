# BBOT Dashboard (Next.js + shadcn)

A lightweight dashboard that uses the BBOT Server REST API directly, showing live metrics, tables, and event feeds.

## Running the Next.js UI

```bash
cd apps/dashboard
npm install
npm run dev
```

Configure the UI to point at your BBOT server by setting:

- `NEXT_PUBLIC_BBOT_API` (default `http://localhost:8807/v1`)
- `NEXT_PUBLIC_BBOT_API_KEY` (API key for BBOT Server)

Example:

```bash
NEXT_PUBLIC_BBOT_API=http://localhost:8807/v1 NEXT_PUBLIC_BBOT_API_KEY=example npm run dev
```

The landing page uses server components to pull `/assets/hosts`, `/events/list`, `/assets/stats`,
`/assets/technologies/summarize`, `/assets/open_ports/list`, and `/scans/targets/count` every 30 seconds, surfacing
asset summaries, KPIs for targets/technologies/ports, and recent event activity in a shadcn-themed layout.
