import { streamText, tool, StreamingTextResponse, embed } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createClient } from "@supabase/supabase-js";

// Safe API Initializers (Graceful degradation for local hacking)
const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN 
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

const ratelimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"), // Max 10 requests per 10s
}) : null;

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export const maxDuration = 30;

// No Mockup Fallbacks Permitted for Production 
const FAKE_DB: any[] = [];

async function getLiveEvents(vibe: string) {
    if (supabase) {
        // Architecture Missing Requirement fixed natively! Assumes `live_events` table exists with pgvector `embedding` tracking.
        console.log("Supabase attached! Running full vector search logic.");
        try {
            const { embedding } = await embed({
                model: googleProvider.textEmbeddingModel('gemini-embedding-001'),
                value: vibe,
            });

            const { data, error } = await supabase.rpc('match_events', { 
                query_embedding: embedding, 
                match_threshold: 0.1,
                match_count: 10,
                search_time: new Date().toISOString()
            });

            if (error) {
                 console.error("Supabase RPC Match_Events error:", error);
                 return FAKE_DB;
            }
            if (data && data.length > 0) return data;
        } catch (e) {
            console.error("Embedding or vector search exception:", e);
        }
    }
    return FAKE_DB; // Graceful offline/local fallback
}

export async function POST(req: Request) {
  try {
    // Missing Requirement 3: Security & Upstash Rate Limiting
    if (ratelimit) {
        const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
        const { success } = await ratelimit.limit(ip);
        if (!success) {
            return new Response("Too Many Requests", { status: 429 });
        }
    }

    const { messages } = await req.json();

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
    }

    const lastUserMessage = messages.slice().reverse().find((m: any) => m.role === 'user')?.content || "event";
    const liveDynamicDB = await getLiveEvents(lastUserMessage);

    const result = await streamText({
      model: googleProvider('gemini-2.5-flash'), // Upgraded from 1.5 flash that was restricting
      messages,
      system: "You are the CURRENT Live Urban Pulse Agent for San Francisco. Analyze user messages! \n\n" +
              "1. Search the available live events.\n" +
              "2. For vibe-requests: Call `update_map` to supply 1 to 3 matching events (NEVER 0), assigning each a mood `match_score` (0-100) and a short 'Insight'.\n" +
              "3. Return a cyber-noir 1-sentence response like a system terminal HUD.\n\nAVAILABLE EVENTS DATABASE:\n" + JSON.stringify(liveDynamicDB, null, 2),
      tools: {
        update_map: tool({
          description: 'Update the map HUD with exactly the events matching the vibe search. You MUST cross-reference their start/end times with the current system time to explicitly flag event temporal logic.',
          parameters: z.object({
            events: z.array(z.object({
              id: z.number(),
              match_score: z.number(),
              insight: z.string(),
              time_status: z.string().describe("E.g. 'LIVE NOW', 'ENDING SOON', or 'STARTS IN 1H'")
            }))
          }),
          execute: async ({ events }: { events: { id: number, match_score: number, insight: string, time_status: string }[] }) => {
            const enrichedEvents = events.map((e) => {
              const dbEvent = liveDynamicDB.find((db: any) => db.id === e.id);
              if (!dbEvent) return null;
              return { ...dbEvent, match_score: e.match_score, insight: e.insight, time_status: e.time_status, image_url: dbEvent.image_url };
            }).filter(Boolean);
            return { enriched_events: enrichedEvents };
          },
        })
      },
    });

    // @ts-ignore
    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("AI ROUTE ERROR:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
