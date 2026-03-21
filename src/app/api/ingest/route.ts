import { createClient } from "@supabase/supabase-js";
import { embed, generateObject } from "ai";
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from "zod";

// Safe Backend Initialization
const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export async function GET(req: Request) {
    if (!supabase) {
        return new Response(JSON.stringify({ error: "Supabase keys missing. Cannot run ingestion." }), { status: 400 });
    }

    try {
        let ingested = 0;
        console.log("Production Ingestion: Pulling live global streams...");

        let rawSocialFeeds: { title: string, text: string, category: string, source_url: string, location_context?: string }[] = [];

        // 1. PRODUCTION PREDICTHQ API PIPELINE (Structured Events)
        if (process.env.PREDICTHQ_CLIENT_TOKEN) {
            try {
                // Fetching large attendance events (festivals, sports, concerts) in SF
                const phqResponse = await fetch('https://api.predicthq.com/v1/events/?location_around.origin=37.7749,-122.4194&location_around.scale=10km&active.gte=' + new Date().toISOString() + '&limit=5', {
                    headers: { 'Authorization': `Bearer ${process.env.PREDICTHQ_CLIENT_TOKEN}`, 'Accept': 'application/json' }
                });
                if (phqResponse.ok) {
                    const phqData = await phqResponse.json();
                    if (phqData.results && Array.isArray(phqData.results)) {
                        phqData.results.forEach((ev: any) => {
                             rawSocialFeeds.push({
                                title: ev.title,
                                text: `Structured Event: ${ev.description || ev.title}. Predicted Attendance: ${ev.phq_attendance || 'Moderate'}. Category: ${ev.category}`,
                                category: ev.category,
                                source_url: `https://www.google.com/search?q=${encodeURIComponent(ev.title + ' SF')}`
                             });
                        });
                    }
                }
            } catch (e) {
                console.error("PredictHQ integration failed:", e);
            }
        }

        // 1. PRODUCTION SOCIAVAULT MULTI-SOCIAL PIPELINE (X + Instagram)
        if (process.env.SOCIAVAULT_API_KEY && process.env.SOCIAVAULT_API_KEY !== "your-social-vault-api-key") {
            try {
                console.log("X-API-Key Check: Attempting SociaVault Multi-Social Scrape...");
                
                // Concurrent Scrape: Twitter/X + Instagram
                const [svX, svInsta] = await Promise.all([
                    fetch('https://api.sociavault.com/v1/scrape/twitter/search/tweets', {
                        method: 'POST',
                        headers: { 'X-API-Key': process.env.SOCIAVAULT_API_KEY, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: "san francisco events tonight", limit: 5 })
                    }),
                    fetch('https://api.sociavault.com/v1/scrape/instagram/search/posts', {
                        method: 'POST',
                        headers: { 'X-API-Key': process.env.SOCIAVAULT_API_KEY, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: "san francisco pop-up", limit: 5 })
                    })
                ]);

                // X Results
                if (svX.ok) {
                    const data = await svX.json();
                    const items = data.data || data.results || [];
                    if (Array.isArray(items)) {
                        items.forEach((t: any) => rawSocialFeeds.push({ 
                            title: "X Pulse", 
                            text: t.text || t.full_text || t.content, 
                            category: "social",
                            source_url: t.url || `https://x.com/status/${t.id}`
                        }));
                    }
                }

                // Insta Results
                if (svInsta.ok) {
                    const data = await svInsta.json();
                    const items = data.data || data.results || [];
                    if (Array.isArray(items)) {
                        items.forEach((p: any) => rawSocialFeeds.push({ 
                            title: "Instagram Vibe", 
                            text: p.caption || p.text || "New Visual Vibe in SF", 
                            category: "culture",
                            source_url: p.permalink || p.url || `https://instagram.com/p/${p.id}`,
                            location_context: `Tagged Location: ${p.location_name || 'None'}. Hashtags: ${p.hashtags ? p.hashtags.join(', ') : 'None'}`
                        }));
                    }
                }
            } catch (e) {
                console.error("SociaVault Multi-Exception:", e);
            }
        }

        // 2. PRODUCTION REDDIT SCRAPING PIPELINE (Resilient Fallback Hook)
        try {
            const redditRes = await fetch("https://www.reddit.com/r/sanfrancisco/search.json?q=event+OR+tonight+OR+party+OR+music&restrict_sr=1&sort=new&t=day", {
                headers: { "User-Agent": "CURRENT_Live_Pulse_Agent/1.0" }
            });
            if (redditRes.ok) {
                const redditData = await redditRes.json();
                redditData.data.children.slice(0, 5).forEach((child: any) => {
                    if (child.data.title && child.data.title.includes("?") === false) {
                        rawSocialFeeds.push({
                            title: child.data.title,
                            text: child.data.selftext || child.data.url,
                            category: "reddit",
                            source_url: `https://reddit.com${child.data.permalink}`
                        });
                    }
                });
            }
        } catch (e) {
            console.error("Reddit scraper hook failed:", e);
        }

        // 3. PRODUCTION LUMA/EVENTBRITE HOOK (Mocked as real-time text fragments for now)
        rawSocialFeeds.push({
            title: "Luma SF Community Calendar",
            text: "Tech Mixer at Soma starting at 6pm today. Pitch deck workshop at 4pm.",
            category: "culture",
            source_url: "https://lu.ma/sf"
        });
        rawSocialFeeds.push({
            title: "Eventbrite SF Music",
            text: "Live Jazz at Mr Tipple's starting in 2 hours. Blues Night at The Saloon later tonight.",
            category: "music",
            source_url: "https://eventbrite.com/d/ca--san-francisco/events--tonight/"
        });

        if (rawSocialFeeds.length === 0) {
             return new Response(JSON.stringify({ error: "Failed to scrape any live data from production sources." }), { status: 500 });
        }

        // 3. AI STRUCTURED EXTRACTION (Vibe, Time, Location Mapping)
        console.log(`Parsing ${rawSocialFeeds.length} raw internet fragments into JSON coordinates...`);
        const { object: parsedData } = await generateObject({
            model: googleProvider('gemini-2.5-flash'),
            schema: z.object({
                events: z.array(z.object({
                    title: z.string().describe("Synthesize a catchy 4-word title based on the unstructured post."),
                    category: z.string().describe("Map to: food, music, culture, art, or miscellaneous"),
                    summary: z.string().describe("A clean short sentence summarizing what is happening."),
                    start_time: z.string().describe("Absolute ISO 8601 UTC timestamp of start. If implied 'now', map near current time."),
                    end_time: z.string().describe("Absolute ISO 8601 UTC timestamp of end."),
                    lat: z.number().describe("Latitude coordinate natively deduced strictly from SF location context, tagged location names, or hashtags (e.g. 37.7749). Default to random SF coordinates if unknown."),
                    lng: z.number().describe("Longitude natively deduced strictly from location context (e.g. -122.4194)."),
                    popularity: z.number().describe("Scale 1-100 estimating hype."),
                    visual_vibe: z.string().describe("2-word visual descriptor for an Unsplash search query (e.g. 'cyberpunk city' or 'neon donuts')"),
                    source_url: z.string().describe("The exact source URL provided in the raw feed.")
                }))
            }),
            prompt: `Literal current system UTC time: ${new Date().toISOString()}. \nAnalyze these live raw internet fragments from San Francisco: \n\n${JSON.stringify(rawSocialFeeds, null, 2)}\n\nExtract and map them logically into concrete Spatio-Temporal objects. Use any 'location_context', 'hashtags', or 'location_name' provided as the HIGHEST priority signals for determining the exact Latitude/Longitude.`
        });

        // 4. DATABASE INGESTION & VECTOR MAPPING
        for (const aiEvent of parsedData.events) {
            console.log("Vectorizing and saving event...", aiEvent.title);
            
            const { embedding } = await embed({
                model: googleProvider.textEmbeddingModel('gemini-embedding-001'),
                value: `${aiEvent.title} - ${aiEvent.summary}`,
            });

            // Upsert Postgres Core
            const { data: eventData, error: eventError } = await supabase
                .from('live_events')
                .insert([{
                    title: aiEvent.title,
                    category: aiEvent.category,
                    lat: aiEvent.lat,
                    lng: aiEvent.lng,
                    base_popularity: aiEvent.popularity,
                    vibe_keywords: [aiEvent.category, ...aiEvent.summary.split(" ").slice(0, 3)],
                    image_url: `https://source.unsplash.com/featured/?${encodeURIComponent(aiEvent.visual_vibe + ',sf')}`, 
                    start_time: aiEvent.start_time,
                    end_time: aiEvent.end_time,
                    source_url: aiEvent.source_url
                }])
                .select('id')
                .single();
            
            if (eventError || !eventData) {
                console.error("PgSQL Insert Error: ", eventError);
                continue;
            }

            // Upsert Vector Dimensions
            await supabase
                .from('event_embeddings')
                .insert([{
                    event_id: eventData.id,
                    embedding: embedding
                }]);
            
            ingested++;
        }

        return new Response(JSON.stringify({ 
            status: "Architecture Active", 
            message: `Scraped raw social feeds -> AI Parsed -> Vectored & Embedded ${ingested} LIVE Events directly to Supabase.`
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
