# BBOT Server Dashboard (Next.js + shadcn/ui)

A shadcn-styled Next.js dashboard that visualizes BBOT Server data (assets, technologies, open ports, and findings) using the REST API.

## Prerequisites
- Node.js 18+
- Access to a running BBOT Server and an API key (set via the `X-API-Key` header)

## Setup
```bash
cd dashboard
npm install
```

## Development
Start the Next.js dev server (listens on port 3000):
```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```
Then open `http://localhost:3000` in your browser.

## Usage
1. Enter your BBOT Server base URL (e.g., `http://localhost:8807/v1`) and API key in the **API connection** card.
2. Click **Save settings** to persist the values locally.
3. Click **Refresh** to pull live KPIs, charts, and the asset spotlight from the REST API.

The dashboard relies on the following endpoints:
- `GET /assets/hosts` for asset counts
- `GET /stats` for open ports, technologies, and findings summaries
- `GET /assets/{host}/detail` (for the top hosts) to show spotlight details

## Production build
```bash
npm run build
npm run start
```

The build output is generated in `.next/` and uses a standalone Next.js output for easier deployment.
