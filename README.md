# CURRENT — The Live Urban Pulse Agent

Describe a vibe. Get real-time events near you on a cyber-noir map.

CURRENT is an AI-powered app that takes a natural-language mood description ("cozy jazz night," "high energy dance," "chill outdoor hang") and matches it to live events in San Francisco using vector similarity search, then renders them on a dark retro-styled map.

**[Try it live →](https://current-app-pi.vercel.app)**

## How It Works

1. **Describe your vibe** in the RPG-style chat input
2. **Gemini 2.5 Flash** interprets your intent and queries a Supabase pgvector index of embedded events
3. **Matching events** appear as pulsing markers on the map, color-coded by match score (0-100)
4. **Typewriter-animated insights** tell you why each event fits your vibe

## Features

- Full-screen dark Mapbox map with pixelated retro aesthetic (CRT scanlines, grid overlay, vignette)
- RPG/SNES-style dialogue boxes with "Press Start 2P" pixel font
- AI chat with streaming responses and tool calling (`update_map`)
- Event markers with pulsing animations and match-score color coding
- Geolocation support (fly to your position)
- Multi-source event ingestion: PredictHQ, SociaVault (X/Instagram), Reddit r/sanfrancisco, Luma, Eventbrite
- Rate limiting via Upstash Redis (10 req / 10s)

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **AI:** Vercel AI SDK, Google Gemini 2.5 Flash
- **Database:** Supabase with pgvector embeddings
- **Map:** Mapbox GL via react-map-gl
- **Rate Limiting:** Upstash Redis
- **Styling:** Tailwind CSS 4

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project with pgvector enabled
- Mapbox, Google AI, and Upstash accounts

### Environment Variables

```env
GOOGLE_GENERATIVE_AI_API_KEY=     # Gemini API key
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role key
NEXT_PUBLIC_MAPBOX_TOKEN=         # Mapbox access token
UPSTASH_REDIS_REST_URL=           # Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=         # Upstash Redis REST token
PREDICTHQ_CLIENT_TOKEN=           # PredictHQ API token (optional, for ingest)
SOCIAVAULT_API_KEY=               # SociaVault API key (optional, for ingest)
```

### Database Setup

In the Supabase SQL editor, run `supabase/migrations/001_initial_schema.sql`. This creates:
- `live_events` table
- `event_embeddings` table with `vector(3072)` columns (gemini-embedding-001 output size)
- `match_events()` RPC for cosine similarity search

> **Note:** Supabase free-tier projects pause after ~1 week of inactivity. If your deployment returns `SIGNAL LOST`, resume the project from the Supabase dashboard — DNS takes a minute to propagate after resume.

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Ingest Events

`GET /api/ingest` scrapes configured sources, extracts structured events via Gemini, runs 3-tier deduplication (exact URL → fuzzy title+temporal → semantic vector), embeds with `gemini-embedding-001`, and stores in Supabase. Expired events (ended 2h+ ago) are auto-cleaned on each run so sources can re-populate fresh.

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main page — map + chat UI
│   └── api/
│       ├── chat/route.ts     # AI chat endpoint (Gemini + vector search + tools)
│       └── ingest/route.ts   # Event ingestion pipeline
├── components/
│   ├── Map.tsx               # Mapbox map with markers, fog-of-war, flyTo
│   └── TypewriterText.tsx    # Typewriter animation component
supabase/
└── migrations/
    └── 001_initial_schema.sql  # live_events, event_embeddings, match_events()
```

## License

MIT
