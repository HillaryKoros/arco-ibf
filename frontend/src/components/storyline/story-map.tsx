"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import maplibregl from "maplibre-gl";
import { feature } from "topojson-client";
import { Layers } from "lucide-react";

export type SeverityLevel = "extreme" | "severe" | "high" | "moderate";

export interface ChapterData {
  center: [number, number];
  zoom: number;
  severity?: SeverityLevel;
  markerLabel?: string;
  iso3?: string;
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

function makeBaseStyle(basemap: string) {
  const bm = BASEMAPS[basemap] || BASEMAPS.satellite;
  return {
    version: 8 as const,
    sources: {
      base: { type: "raster" as const, tiles: bm.tiles, tileSize: 256 },
    },
    layers: [
      { id: "base", type: "raster" as const, source: "base" },
    ],
  };
}

// Country name → ISO3
const COUNTRY_ISO3: Record<string, string> = {
  "Burundi": "BDI", "Djibouti": "DJI", "Eritrea": "ERI",
  "Ethiopia": "ETH", "Kenya": "KEN", "Rwanda": "RWA",
  "Somalia": "SOM", "South Sudan": "SSD", "Sudan": "SDN",
  "Tanzania": "TZA", "Uganda": "UGA",
};

// Extract ISO3 from GID_1 (e.g. "ETH.5_1" → "ETH")
function gidToIso(gid: string): string {
  return gid.split(".")[0];
}

// Compute bbox from GeoJSON features filtered by ISO3
function bboxForCountry(features: GeoJSON.Feature[], iso3: string): [number, number, number, number] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;
  for (const f of features) {
    if (gidToIso((f.properties as Record<string, string>)?.GID_1 || "") !== iso3) continue;
    found = true;
    const extract = (c: unknown) => {
      if (Array.isArray(c) && typeof c[0] === "number") {
        if (c[0] < minX) minX = c[0];
        if (c[1] < minY) minY = c[1];
        if (c[0] > maxX) maxX = c[0];
        if (c[1] > maxY) maxY = c[1];
        return;
      }
      if (Array.isArray(c)) for (const s of c) extract(s);
    };
    extract((f.geometry as GeoJSON.Polygon).coordinates);
  }
  return found ? [minX, minY, maxX, maxY] : null;
}

// ── StoryMap ──

interface StoryMapProps {
  center: [number, number];
  zoom: number;
  className?: string;
  markerLabel?: string;
  severity?: SeverityLevel;
  interactive?: boolean;
  iso3?: string;
}

export function StoryMap({ center, zoom, className = "", markerLabel, severity = "high", interactive = false, iso3 }: StoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const adminLoadedRef = useRef(false);
  const featuresRef = useRef<GeoJSON.Feature[]>([]);
  const [activeBasemap, setActiveBasemap] = useState("satellite");
  const [showPicker, setShowPicker] = useState(false);

  const lat = center[0];
  const lng = center[1];

  // Init map + load admin1 GeoJSON
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: makeBaseStyle(activeBasemap),
      center: [lng, lat],
      zoom,
      interactive,
    });
    mapRef.current = map;

    map.on("load", async () => {
      try {
        const res = await fetch("/data/icpac_adm1v3.json");
        const topo = await res.json();
        const objKey = Object.keys(topo.objects)[0];
        const geojson = feature(topo, topo.objects[objKey]) as unknown as GeoJSON.FeatureCollection;
        featuresRef.current = geojson.features;

        map.addSource("admin1", { type: "geojson", data: geojson });

        // Fill — highlighted country
        map.addLayer({
          id: "admin1-fill",
          type: "fill",
          source: "admin1",
          paint: {
            "fill-color": "#ffffff",
            "fill-opacity": 0.08,
          },
        });

        // Border — all regions
        map.addLayer({
          id: "admin1-border",
          type: "line",
          source: "admin1",
          paint: {
            "line-color": "#ffffff",
            "line-width": 0.6,
            "line-opacity": 0.3,
          },
        });

        // Active country highlight border
        map.addLayer({
          id: "admin1-highlight-border",
          type: "line",
          source: "admin1",
          paint: {
            "line-color": "#ffffff",
            "line-width": 2,
            "line-opacity": 0.8,
          },
          filter: ["==", "GID_1", ""],
        });

        adminLoadedRef.current = true;
      } catch (err) {
        console.error("Failed to load admin1 boundaries", err);
      }
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update map when chapter changes — highlight country, fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const color = SEVERITY_COLORS[severity];

    const applyHighlight = () => {
      if (!adminLoadedRef.current || !map.getLayer("admin1-fill")) return;

      if (iso3) {
        // Highlight active country's admin1 regions
        map.setPaintProperty("admin1-fill", "fill-color", [
          "case",
          ["==", ["slice", ["get", "GID_1"], 0, 3], iso3], `${color}55`,
          "rgba(0,0,0,0.4)",
        ]);
        map.setPaintProperty("admin1-fill", "fill-opacity", 0.7);

        // Highlight border for active country
        map.setFilter("admin1-highlight-border", [
          "==", ["slice", ["get", "GID_1"], 0, 3], iso3,
        ]);
        map.setPaintProperty("admin1-highlight-border", "line-color", color);

        // Dim other borders
        map.setPaintProperty("admin1-border", "line-color", [
          "case",
          ["==", ["slice", ["get", "GID_1"], 0, 3], iso3], color,
          "rgba(255,255,255,0.2)",
        ]);

        // Fit to country bbox from geometry
        const bbox = bboxForCountry(featuresRef.current, iso3);
        if (bbox) {
          map.fitBounds(
            [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
            { padding: 60, duration: 2000, maxZoom: zoom, essential: true }
          );
        } else {
          map.easeTo({ center: [lng, lat], zoom, duration: 2000, essential: true });
        }
      } else {
        // Reset to default
        map.setPaintProperty("admin1-fill", "fill-color", "#ffffff");
        map.setPaintProperty("admin1-fill", "fill-opacity", 0.08);
        map.setFilter("admin1-highlight-border", ["==", "GID_1", ""]);
        map.setPaintProperty("admin1-border", "line-color", "#ffffff");
        map.easeTo({ center: [lng, lat], zoom, duration: 2000, essential: true });
      }
    };

    // Apply immediately if loaded, or wait for load
    if (adminLoadedRef.current) {
      applyHighlight();
    } else {
      map.once("load", applyHighlight);
    }
  }, [lat, lng, zoom, severity, markerLabel, iso3]);

  // Switch basemap — preserve admin layers
  const switchBasemap = useCallback((key: string) => {
    const map = mapRef.current;
    if (!map || key === activeBasemap) return;

    // Save current source data
    const adminSource = map.getSource("admin1");
    const adminData = adminSource && "serialize" in adminSource ? (adminSource as maplibregl.GeoJSONSource).serialize() : null;

    map.setStyle(makeBaseStyle(key));
    setActiveBasemap(key);
    setShowPicker(false);

    // Re-add admin layers after style change
    map.once("styledata", () => {
      if (adminData && featuresRef.current.length > 0) {
        const geojson: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: featuresRef.current };
        map.addSource("admin1", { type: "geojson", data: geojson });
        map.addLayer({ id: "admin1-fill", type: "fill", source: "admin1", paint: { "fill-color": "#ffffff", "fill-opacity": 0.08 } });
        map.addLayer({ id: "admin1-border", type: "line", source: "admin1", paint: { "line-color": "#ffffff", "line-width": 0.6, "line-opacity": 0.3 } });
        map.addLayer({ id: "admin1-highlight-border", type: "line", source: "admin1", paint: { "line-color": "#ffffff", "line-width": 2, "line-opacity": 0.8 }, filter: ["==", "GID_1", ""] });
        adminLoadedRef.current = true;
      }
    });
  }, [activeBasemap]);

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {/* Country label */}
      {markerLabel && (
        <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur px-3 py-1.5 rounded-md">
          <span className="text-white text-sm font-bold">{markerLabel}</span>
        </div>
      )}
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
        {/* Scrolling chapter overlay */}
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
  center: string | [number, number];
  zoom: string | number;
  severity?: SeverityLevel;
  markerLabel?: string;
  side?: "left" | "right";
}

function parseCenter(center: string | [number, number]): [number, number] {
  if (typeof center === "string") {
    const parts = center.split(",").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return [parts[0], parts[1]];
  }
  if (Array.isArray(center)) return [Number(center[0]), Number(center[1])];
  return [0, 35];
}

export function Chapter({ children, center, zoom, severity = "high", markerLabel, side = "left" }: ChapterProps) {
  const { setActiveChapter } = useContext(StorylineContext);
  const { ref, inView } = useInView({ threshold: 0.4, triggerOnce: false });

  const parsedCenter = parseCenter(center);
  const parsedZoom = Number(zoom) || 5;

  useEffect(() => {
    if (inView) {
      setActiveChapter({ center: parsedCenter, zoom: parsedZoom, severity, markerLabel });
    }
  }, [inView, parsedCenter[0], parsedCenter[1], parsedZoom, severity, markerLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRight = side === "right";

  return (
    <div ref={ref} className={`min-h-screen flex items-center py-16 px-4 md:px-8 ${isRight ? "lg:justify-end" : "lg:justify-start"}`} style={{ scrollSnapAlign: "start" }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: inView ? 1 : 0.1, y: inView ? 0 : 30 }}
        transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1.0] }}
        className="w-full lg:w-[420px] xl:w-[460px] pointer-events-auto"
      >
        <div className="bg-slate-900/85 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6 md:p-8 shadow-2xl prose prose-invert prose-sm max-w-none">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
