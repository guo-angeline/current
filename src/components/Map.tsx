"use client";

import { useRef, useEffect, useState } from "react";
import Map, { Marker, useMap, MapProvider } from "react-map-gl/mapbox";
import 'mapbox-gl/dist/mapbox-gl.css';

// Default Fallback
const INITIAL_VIEW_STATE = {
  longitude: -122.4085,
  latitude: 37.7850,
  zoom: 13,
  pitch: 0,   // 2D TOp Down
  bearing: 0,
};

type EventType = {
  id: number;
  lat: number;
  lng: number;
  popularity: number;
  title: string;
  match_score?: number;
};

// Map flyTo Controller Component
function MapController({ events, userLocation }: { events: EventType[], userLocation: { lat: number, lng: number } | null }) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map) return;
    
    // 1. Fly to top match if it exists
    const topMatch = events.slice().sort((a, b) => (b.match_score || 0) - (a.match_score || 0))[0];
    if (topMatch && topMatch.match_score && topMatch.match_score > 0) {
      map.flyTo({
        center: [topMatch.lng, topMatch.lat],
        zoom: 15,
        duration: 2000,
        essential: true,
      });
      return;
    }

    // 2. Or, fly to user location on mount if found
    if (userLocation) {
        map.flyTo({
            center: [userLocation.lng, userLocation.lat],
            zoom: 13,
            duration: 1500,
            essential: true
        });
    }
  }, [events, map, userLocation]);

  // Set Label Visibility Zoom Range (Fog of War)
  useEffect(() => {
    if (!map) return;
    const mbMap = map.getMap();

    const applyFogOfWar = () => {
       const style = mbMap.getStyle();
       if (!style || !style.layers) return;

       style.layers.forEach((layer) => {
          if (layer.id.toLowerCase().includes('label') || layer.id.toLowerCase().includes('place')) {
             try {
                // Force these layers to only show above zoom 15
                mbMap.setLayerZoomRange(layer.id, 15, 24);
             } catch (e) {
               // Ignore errors for non-compatible layers
             }
          }
       });
    };

    if (mbMap.isStyleLoaded()) {
      applyFogOfWar();
    } else {
      mbMap.once('style.load', applyFogOfWar);
    }
  }, [map]);

  return null;
}

export default function MapComponent({ events, onEventClick, requestLocTrigger }: { events: EventType[], onEventClick?: (id: number) => void, requestLocTrigger?: number }) {
  const mapRef = useRef(null);
  const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
     if ('geolocation' in navigator && requestLocTrigger) {
        navigator.geolocation.getCurrentPosition((pos) => {
           setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        });
     }
  }, [requestLocTrigger]);

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoiZmFrZSIsImEiOiJjazR2cmo1bmswOWJ5M2tvMmg0b2Y5M3JkIn0.some-fake-token";

  return (
    <MapProvider>
      <div className="w-full h-full relative">
        <Map
          id="main-map"
          ref={mapRef}
          initialViewState={INITIAL_VIEW_STATE}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          dragRotate={false}
          pitchWithRotate={false}
          style={{ width: "100%", height: "100%" }}
          minZoom={11}
          maxZoom={18}
        >
          <MapController events={events} userLocation={userLoc} />

          {/* User Location Pulse */}
          {userLoc && (
              <Marker longitude={userLoc.lng} latitude={userLoc.lat} anchor="center">
                  <div className="w-4 h-4 bg-lime-500 border border-black animate-pulse" />
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-black px-1 py-1 text-[8px] text-lime-500 font-mono border border-lime-500 z-50">YOU</div>
              </Marker>
          )}

          {/* Render Fake Events as "Pixel Pulses" */}
          {events.map((evt) => {
            let pulseClass = "pixel-pulse";
            let scaleStyle = {};
            
            if (evt.match_score === -1) {
              pulseClass += " low-match bg-zinc-800 shadow-none";
            } else if (evt.match_score && evt.match_score > 80) {
              pulseClass += " border-[#00F0FF] border-2";
              scaleStyle = { transform: 'scale(1.5)' };
            } else if (evt.match_score && evt.match_score > 50) {
              pulseClass += " border-[#00F0FF] border";
              scaleStyle = { transform: 'scale(1.2)' };
            }

            return (
              <Marker 
                key={evt.id} 
                longitude={evt.lng} 
                latitude={evt.lat} 
                anchor="center"
                style={{ zIndex: (evt.match_score || 0) + 10 }}
              >
                <button 
                   type="button"
                   className={pulseClass} 
                   style={{...scaleStyle, pointerEvents: 'auto'}} 
                   title={evt.title} 
                   onClick={(e) => {
                     // Ensure button clicks always register, ignoring MapBox layering
                     e.preventDefault();
                     e.stopPropagation();
                     if (onEventClick) onEventClick(evt.id);
                   }}
                />
                
                {Boolean(evt.match_score && evt.match_score > 0) && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 border border-[#00F0FF]/50 px-2 py-1 font-mono text-[8px] text-[#00F0FF] whitespace-nowrap z-50 pointer-events-none">
                    {evt.title}
                  </div>
                )}
              </Marker>
            );
          })}
        </Map>
        
        {/* Retro Overlays */}
        <div className="map-grid-overlay opacity-50"></div>
        <div className="scanlines opacity-20"></div>

        {/* Map Vignette Overlay */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_60px_rgba(0,0,0,0.7)]"></div>
      </div>
    </MapProvider>
  );
}
