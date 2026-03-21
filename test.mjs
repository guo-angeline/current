import { createClient } from "@supabase/supabase-js";
import { embed } from "ai";
import { createGoogleGenerativeAI } from '@ai-sdk/google';


const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const { data: rows, error: readError } = await supabase.from('live_events').select("*");
    console.log("Total events currently in DB:", rows?.length);
    if (rows && rows.length > 0) {
        console.log("First event:", rows[0].title);
    }
    
    // Test embedding extraction natively
    const vibe = "I want techno and loud music";
    const { embedding } = await embed({
        model: googleProvider.textEmbeddingModel('gemini-embedding-001'),
        value: vibe,
    });
    
    console.log("Generated embedding dimension count:", embedding.length);
    
    const { data, error } = await supabase.rpc('match_events', { 
        query_embedding: embedding, 
        match_threshold: 0.0,
        match_count: 5 
    });
    
    const { data: embeds } = await supabase.from('event_embeddings').select("*");
    console.log("First embedding length:", embeds[0]?.embedding ? JSON.parse(embeds[0].embedding).length : "No embedding!");
    console.log("RPC Data returns:", data);
}

test();
