# Map point Gemini enrichment (backend)

Marina and fuel detail fields are filled on the server when `GET /api/map-points/:id` runs and core fields are missing.

## Setup

1. Add to Railway (or local `.env`):

   ```
   GEMINI_API_KEY=AIzaSy...
   ```

2. Deploy this backend. New columns are created automatically on first detail request, or run:

   ```bash
   npm run db:migrate-ai
   ```

## Behaviour

- **Endpoint:** `GET /api/map-points/:id` — may take a few seconds the first time while Gemini runs.
- **Skip:** `GET /api/map-points/:id?enrich=false` — returns DB row only.
- **Cache:** `enriched_at` — no Gemini call again for 7 days per point.
- **Persistence:** Fills `depth_m`, `berth_count`, `vhf_channel`, `opening_hours`, `fuel_types`, `amenities`, `ai_summary`.

## iOS app

The app no longer calls Gemini. It only reads enriched fields from the Pruva API.
