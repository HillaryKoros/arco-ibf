"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import maplibregl from "maplibre-gl";
import { Layers } from "lucide-react";
import { vectorTileUrl, getCountryBbox } from "@/lib/geo-api";

/** Compute bounding box from a GeoJSON geometry */
function getBbox(geom: GeoJSON.Geometry): [number, number, number, number] | null {
  const coords: number[][] = [];
  function extract(c: any) {
    if (typeof c[0] === "number") { coords.push(c); return; }
    for (const sub of c) extract(sub);
  }
  try {
    extract((geom as any).coordinates);
    if (coords.length === 0) return null;
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of coords) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return [minX, minY, maxX, maxY];
  } catch { return null; }
}

export type SeverityLevel = "extreme" | "severe" | "high" | "moderate";

export interface ChapterData {
  center: [number, number];
  zoom: number;
  severity?: SeverityLevel;
  markerLabel?: string;
  iso3?: string; // Country code — used to highlight boundary from TiPG
}

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  extreme: "#dc2626",
  severe: "#ea580c",
  high: "#d97706",
  moderate: "#ca8a04",
};

const BASEMAPS: Record<string, { name: string; tiles: string[] }> = {
  satellite: { name: "Satellite", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"] },
  dark: { name: "Dark", tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"] },
  streets: { name: "Streets", tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"] },
  osm: { name: "OSM", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"] },
};

function makeStyle(basemap: string) {
  const bm = BASEMAPS[basemap] || BASEMAPS.satellite;
  return {
    version: 8 as const,
    sources: {
      base: { type: "raster" as const, tiles: bm.tiles, tileSize: 256 },
      // TiPG admin boundaries — country level
      "admin0-tipg": {
        type: "vector" as const,
        tiles: [vectorTileUrl("admin0_boundaries")],
        minzoom: 0,
        maxzoom: 12,
      },
      // TiPG admin boundaries — province level (shown at higher zoom)
      "admin1-tipg": {
        type: "vector" as const,
        tiles: [vectorTileUrl("admin1_boundaries")],
        minzoom: 4,
        maxzoom: 14,
      },
    },
    layers: [
      { id: "base", type: "raster" as const, source: "base" },
      // Country boundaries — always visible
      {
        id: "admin0-fill",
        type: "fill" as const,
        source: "admin0-tipg",
        "source-layer": "default",
        paint: { "fill-color": "#ffffff", "fill-opacity": 0.05 },
      },
      {
        id: "admin0-border",
        type: "line" as const,
        source: "admin0-tipg",
        "source-layer": "default",
        paint: { "line-color": "#ffffff", "line-width": 1.5, "line-opacity": 0.6 },
      },
      // Province boundaries — visible when zoomed in
      {
        id: "admin1-border",
        type: "line" as const,
        source: "admin1-tipg",
        "source-layer": "default",
        minzoom: 5,
        paint: { "line-color": "#ffffff", "line-width": 0.8, "line-opacity": 0.4, "line-dasharray": [2, 2] },
      },
    ],
  };
}

// ── StoryMap (MapLibre) ──

interface StoryMapProps {
  center: [number, number];
  zoom: number;
  className?: string;
  markerLabel?: string;
  severity?: SeverityLevel;
  interactive?: boolean;
  iso3?: string; // Country code — clip map to this country
}

export function StoryMap({ center, zoom, className = "", markerLabel, severity = "high", interactive = false, iso3 }: StoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [activeBasemap, setActiveBasemap] = useState("satellite");
  const [showPicker, setShowPicker] = useState(false);

  // Stable primitives for dependency tracking
  const lat = center[0];
  const lng = center[1];

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: makeStyle(activeBasemap),
      center: [lng, lat], // maplibre is [lng, lat]
      zoom,
      interactive,
    });
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Fly to country + clip when chapter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Highlight active country — dim others
    if (iso3 && map.getLayer("admin0-fill")) {
      const color = SEVERITY_COLORS[severity];
      map.setFilter("admin0-fill", null); // show all
      map.setPaintProperty("admin0-fill", "fill-color", [
        "case",
        ["==", ["get", "iso3"], iso3], `${color}33`,
        "rgba(0,0,0,0.5)" // dim non-active countries
      ]);
      map.setPaintProperty("admin0-fill", "fill-opacity", 0.6);
      map.setPaintProperty("admin0-border", "line-color", [
        "case",
        ["==", ["get", "iso3"], iso3], color,
        "rgba(255,255,255,0.3)"
      ]);
      map.setPaintProperty("admin0-border", "line-width", [
        "case",
        ["==", ["get", "iso3"], iso3], 2.5,
        0.8
      ]);
    }

    // Fetch country bbox from TiPG SQL function and fitBounds
    if (iso3) {
      getCountryBbox(iso3)
        .then(bbox => {
          if (bbox) {
            map.fitBounds(
              [[bbox.minx, bbox.miny], [bbox.maxx, bbox.maxy]],
              { padding: 40, duration: 1800, maxZoom: zoom }
            );
          } else {
            map.flyTo({ center: [lng, lat], zoom, duration: 1800 });
          }
        })
        .catch(() => {
          map.flyTo({ center: [lng, lat], zoom, duration: 1800 });
        });
    } else {
      map.flyTo({ center: [lng, lat], zoom, duration: 1800 });
    }

    // Update marker
    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
    const color = SEVERITY_COLORS[severity];
    const el = document.createElement("div");
    el.style.cssText = `width:24px;height:24px;border-radius:50%;background:${color}55;border:2px solid ${color};`;
    markerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map);
    if (markerLabel) {
      markerRef.current.setPopup(
        new maplibregl.Popup({ closeButton: false, offset: 15 }).setText(markerLabel)
      ).togglePopup();
    }
  }, [lat, lng, zoom, severity, markerLabel, iso3]);

  // Switch basemap
  const switchBasemap = useCallback((key: string) => {
    if (!mapRef.current || key === activeBasemap) return;
    mapRef.current.setStyle(makeStyle(key));
    setActiveBasemap(key);
    setShowPicker(false);
  }, [activeBasemap]);

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {/* Basemap switcher */}
      <div className="absolute top-3 right-3 z-10">
        <button onClick={() => setShowPicker((v) => !v)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/70 backdrop-blur rounded-md text-xs text-gray-300 hover:bg-black/80">
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{BASEMAPS[activeBasemap].name}</span>
        </button>
        {showPicker && (
          <div className="absolute top-full right-0 mt-1 bg-black/90 backdrop-blur rounded-md overflow-hidden shadow-xl min-w-[120px]">
            {Object.entries(BASEMAPS).map(([key, bm]) => (
              <button key={key} onClick={() => switchBasemap(key)} className={`w-full text-left px-3 py-2 text-xs transition-colors ${key === activeBasemap ? "bg-blue-600/30 text-blue-300" : "text-gray-400 hover:text-white"}`}>{bm.name}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Storyline Context ──

const StorylineContext = createContext<{
  activeChapter: ChapterData | null;
  setActiveChapter: (c: ChapterData) => void;
}>({ activeChapter: null, setActiveChapter: () => {} });

// ── Storyline (sticky map + scrolling chapters) ──

interface StorylineProps {
  children: ReactNode;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

// Country name → ISO3 lookup for TiPG boundary queries
const COUNTRY_ISO3: Record<string, string> = {
  "Burundi": "BDI", "Djibouti": "DJI", "Eritrea": "ERI",
  "Ethiopia": "ETH", "Kenya": "KEN", "Rwanda": "RWA",
  "Somalia": "SOM", "South Sudan": "SSD", "Sudan": "SDN",
  "Tanzania": "TZA", "Uganda": "UGA",
};

export function Storyline({ children, defaultCenter = [5, 35], defaultZoom = 4 }: StorylineProps) {
  const [activeChapter, setActiveChapter] = useState<ChapterData | null>(null);

  const mapCenter = activeChapter?.center || defaultCenter;
  const mapZoom = activeChapter?.zoom || defaultZoom;
  const activeIso3 = activeChapter?.markerLabel ? COUNTRY_ISO3[activeChapter.markerLabel] : undefined;

  return (
    <StorylineContext.Provider value={{ activeChapter, setActiveChapter }}>
      <div className="relative">
        {/* Sticky full-viewport map */}
        <div className="sticky top-14 z-0 w-full" style={{ height: "calc(100vh - 3.5rem)" }}>
          <StoryMap
            center={mapCenter}
            zoom={mapZoom}
            className="w-full h-full"
            markerLabel={activeChapter?.markerLabel}
            severity={activeChapter?.severity || "high"}
            iso3={activeIso3}
          />
        </div>
        {/* Scrolling chapter overlay — pulled up over the map */}
        <div className="relative z-10 pointer-events-none" style={{ marginTop: "calc(-100vh + 3.5rem)" }}>
          {children}
        </div>
      </div>
    </StorylineContext.Provider>
  );
}

// ── Chapter (scroll-triggered) ──

interface ChapterProps {
  children: ReactNode;
  center: string | [number, number]; // MDX passes "lat,lng" string
  zoom: string | number;
  severity?: SeverityLevel;
  markerLabel?: string;
  side?: "left" | "right";
}

// Parse center from either "lat,lng" string or [lat,lng] array
function parseCenter(center: string | [number, number]): [number, number] {
  if (typeof center === "string") {
    const parts = center.split(",").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return [parts[0], parts[1]];
    }
  }
  if (Array.isArray(center)) {
    return [Number(center[0]), Number(center[1])];
  }
  return [0, 35]; // fallback: East Africa
}

export function Chapter({ children, center, zoom, severity = "high", markerLabel, side = "left" }: ChapterProps) {
  const { setActiveChapter } = useContext(StorylineContext);
  const { ref, inView } = useInView({ threshold: 0.3, triggerOnce: false });

  const parsedCenter = parseCenter(center);
  const parsedZoom = Number(zoom) || 5;

  useEffect(() => {
    if (inView) {
      setActiveChapter({ center: parsedCenter, zoom: parsedZoom, severity, markerLabel });
    }
  }, [inView, parsedCenter[0], parsedCenter[1], parsedZoom, severity, markerLabel]);

  const isRight = side === "right";

  return (
    <div ref={ref} className={`min-h-[80vh] flex items-center py-16 px-4 md:px-8 ${isRight ? "lg:justify-end" : "lg:justify-start"}`}>
      <motion.div
        initial={{ opacity: 0, x: isRight ? 40 : -40 }}
        animate={{ opacity: inView ? 1 : 0.15, x: inView ? 0 : (isRight ? 40 : -40) }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="w-full lg:w-[420px] xl:w-[460px] pointer-events-auto"
      >
        <div className="bg-slate-900/85 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6 md:p-8 shadow-2xl prose prose-invert prose-sm max-w-none">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
