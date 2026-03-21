"use client";

import { useState, useEffect, useMemo } from "react";
import MapComponent from "@/components/Map";
import { Activity } from "lucide-react";
import { useChat } from "ai/react";
import TypewriterText from "@/components/TypewriterText";

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [requestLoc, setRequestLoc] = useState<number>(0);
  
  // Extract the latest updated map events from the tool invocations
  const activeEvents = useMemo(() => {
    // Default initial pulses representing general popularity
    let events: any[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
       const m = messages[i];
       if (m.toolInvocations) {
         // Handle standard map updates
         const updateMapTool = m.toolInvocations.find(t => t.toolName === 'update_map' && ('result' in t));
         if (updateMapTool && 'result' in updateMapTool) {
           const aiResults = (updateMapTool as any).result.enriched_events;
           
           const combined = [...events];
           for (const ai of aiResults) {
              const existingIndex = combined.findIndex(b => b.id === ai.id);
              if (existingIndex >= 0) {
                  combined[existingIndex] = { ...combined[existingIndex], ...ai };
              } else {
                  combined.push({ ...ai, popularity: ai.base_popularity || 50 });
              }
           }
           
           events = combined.map(e => {
             const isIncluded = aiResults.some((ai: any) => ai.id === e.id);
             return isIncluded ? e : { ...e, match_score: -1 };
           });
           break;
         }
       }
    }
    return events;
  }, [messages]);

  useEffect(() => {
     const bestMatch = activeEvents.slice().sort((a,b) => (b.match_score || 0) - (a.match_score || 0))[0];
     if (bestMatch && bestMatch.match_score && bestMatch.match_score > 0) {
        setSelectedEventId(bestMatch.id);
     }
  }, [activeEvents]);

  const systemMessage = messages.slice().reverse().find(m => m.role === 'assistant' && m.content)?.content || "SYSTEM ONLINE. READY FOR VIBE SCAN.";

  const handleCopyMapAddress = (e: any) => {
    if (!selectedEvent) return;
    const address = `${selectedEvent.lat}, ${selectedEvent.lng}`;
    navigator.clipboard.writeText(address);
    e.target.innerText = "COPIED!";
    setTimeout(() => { e.target.innerText = "COPY ADDRESS"; }, 2000);
  };

  const selectedEvent = activeEvents.find(e => e.id === selectedEventId);

  return (
    <main className="relative flex flex-col h-screen w-full overflow-hidden bg-black">
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <MapComponent events={activeEvents} onEventClick={setSelectedEventId} requestLocTrigger={requestLoc} />
      </div>

      {/* RPG UI Layer: Top Header */}
      <header className="absolute top-0 left-1/2 -translate-x-1/2 z-40 p-6 flex justify-center items-start pointer-events-none w-full max-w-xl">
        <div className="rpg-box text-white px-6 py-3 flex items-center gap-6 pointer-events-auto">
          <div className="flex flex-col gap-1">
             <h1 className="rpg-font text-[10px] text-white tracking-widest font-bold">
               CURRENT <span className="text-zinc-400 mx-2">–</span> 
               <span className="text-[#00F0FF]">THE LIVE URBAN PULSE AGENT</span>
             </h1>
             <div className="flex items-center gap-3">
                <span className="rpg-font text-[6px] text-lime-500 animate-pulse">WORLD MAP ENABLED</span>
             </div>
          </div>
          <button 
             onClick={() => setRequestLoc(Date.now())}
             className="rpg-font text-[8px] border border-white/20 p-2 hover:bg-[#00F0FF] hover:text-black transition-all"
             title="Locate Me"
          >
            LOC
          </button>
        </div>
      </header>

      {/* Cyber-Noir UI Layer: Bottom Input Pill */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-sm z-40 pointer-events-none">
        
        {/* The RPG Dialogue Box Selector */}
        {selectedEvent && (
          <div className="mb-6 rpg-box p-6 animate-in duration-500 fade-in slide-in-from-bottom-5 pointer-events-auto backdrop-blur-3xl relative overflow-hidden">
            <h3 className="rpg-font text-[#d4af37] text-[10px] mb-3 flex items-center gap-2">
              <span className="animate-pulse">▼</span> EVENT PULSE DETECTED
            </h3>

            <div className="rpg-font text-white text-[9px] mb-4 leading-relaxed leading-[1.8]">
              <TypewriterText text={selectedEvent.insight || "SCANNING FOR RELEVANT DATA... LIVE EVENT PULSING."} />
            </div>

            <div className="flex border-t border-white/20 pt-4 mt-2 justify-between items-center">
               <div className="flex flex-col gap-1">
                  <div className="rpg-font text-[#00F0FF] text-[8px] uppercase">
                    {selectedEvent.title}
                  </div>
                  <div className="rpg-font text-zinc-400 text-[6px] tracking-widest uppercase">
                    Vibe Match: {selectedEvent.match_score || "??"}%
                  </div>
               </div>

               <div className="flex gap-2">
                 {selectedEvent.source_url && (
                    <a 
                      href={selectedEvent.source_url} 
                      target="_blank" 
                      className="rpg-font text-[7px] border border-white/40 px-3 py-1 hover:bg-white hover:text-black transition-colors"
                    >
                       ENTER
                    </a>
                 )}
                 <button 
                   onClick={handleCopyMapAddress}
                   className="rpg-font text-[7px] border border-white/40 px-3 py-1 hover:bg-[#00F0FF] hover:text-black transition-colors"
                 >
                   NAV
                 </button>
                 <button 
                   onClick={() => setSelectedEventId(null)}
                   className="rpg-font text-[7px] bg-red-900 text-white px-3 py-1 hover:bg-red-700 transition-colors"
                 >
                   EXIT
                 </button>
               </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rpg-box flex items-center p-3 relative overflow-hidden pointer-events-auto">
          {isLoading && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />}

          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Describe your vibe..."
            className="flex-1 bg-transparent border-none text-white placeholder-white/30 focus:outline-none px-4 rpg-font text-[8px] z-10"
            disabled={isLoading}
          />
          
          <button type="submit" disabled={isLoading} className="z-10 bg-[#00F0FF] text-black px-4 py-2 rpg-font text-[8px] font-bold hover:bg-white transition-colors disabled:opacity-50 shadow-[2px_2px_0_rgba(0,0,0,1)]">
            {isLoading ? "..." : "SCAN"}
          </button>
        </form>
        
        {/* Status Text Below Input - Hide if event is selected */}
        {!selectedEvent && (
          <div className="flex justify-between items-start mt-4 px-3 w-full gap-4">
            <p className="rpg-font text-[6px] text-[#00F0FF]/80 uppercase tracking-tight animate-pulse flex-1 leading-normal">
              {systemMessage}
            </p>
            <p className="rpg-font text-[6px] text-white/30 uppercase tracking-widest text-right whitespace-nowrap">
              SEC 7
            </p>
          </div>
        )}
      </div>

      {/* Overlays: Scanline Effect */}
      <div className="scanlines"></div>
      
      {/* Overlays: MicroCRT flicker */}
      <div className="absolute inset-0 pointer-events-none z-50 crt-flicker mix-blend-overlay bg-[radial-gradient(circle,rgba(255,255,255,0.03)_0%,rgba(0,0,0,0.6)_100%)]"></div>
    </main>
  );
}
