# CURRENT — The Live Urban Pulse Agent

Describe a vibe. Get real-time events near you on a cyber-noir map.

CURRENT is an AI-powered app that takes a natural-language mood description ("cozy jazz night," "high energy dance," "chill outdoor hang") and matches it to live events in San Francisco using vector similarity search, then renders them on a dark retro-styled map.

**[Try it live →](https://github.com/guo-angeline/current)**

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

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Ingest Events

POST to `/api/ingest` to pull events from configured sources, extract structured data via AI, embed, and store in Supabase.

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
```

## License

MIT
