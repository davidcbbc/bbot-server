# BBOT Dashboard (Next.js + shadcn)

A lightweight dashboard that pairs a FastAPI bridge with a shadcn-styled Next.js front end. The FastAPI service shapes BBOT
Server data into UI-friendly responses, and the UI renders them as live metrics, tables, and event feeds.

## Running the FastAPI bridge

```bash
# install server deps via poetry or pip
poetry install --with dev
poetry run uvicorn dashboard_backend.main:app --reload
# or
python -m pip install -e .
uvicorn dashboard_backend.main:app --reload
```

Environment variables:

- `DASHBOARD_BBOT_API_URL` (default `http://localhost:8807/v1`)
- `DASHBOARD_BBOT_API_KEY` (API key for BBOT Server)
- `DASHBOARD_DEFAULT_LIMIT` (optional default page size)

## Running the Next.js UI

```bash
cd apps/dashboard
npm install
npm run dev
```

Configure the UI to point at the FastAPI bridge by setting `NEXT_PUBLIC_DASHBOARD_API`, for example:

```bash
NEXT_PUBLIC_DASHBOARD_API=http://localhost:8000 npm run dev
```

The landing page uses server components to pull `/overview` and `/insights` from the bridge every 30 seconds, surfacing
asset summaries and recent event activity in a shadcn-themed layout.
