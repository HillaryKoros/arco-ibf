"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import MapGL, { NavigationControl, Popup } from "react-map-gl/maplibre";
import type { MapRef, MapLayerMouseEvent } from "react-map-gl/maplibre";
import { vectorTileUrl } from "@/lib/geo-api";
import type { Region } from "@/lib/api";

interface Props {
  regions: Region[];
  adminLevel?: 0 | 1 | 2;
  colorScheme?: "drought" | "flood";
  /** Compact mode for compare view — smaller height, no basemap switcher */
  compact?: boolean;
}

// IGAD region bounds — covers Djibouti to Tanzania, Sudan to Somalia
const IGAD_BOUNDS = { longitude: 37.5, latitude: 2, zoom: 3.8 };

const DROUGHT_COLORS = (freq: number) => {
  if (freq >= 6) return "#67000d";
  if (freq >= 4) return "#cb181d";
  if (freq >= 3) return "#fb6a4a";
  if (freq >= 2) return "#fdae6b";
  if (freq >= 1) return "#fee5d9";
  return "#f0f0e8";
};

const FLOOD_COLORS = (freq: number) => {
  if (freq >= 6) return "#08306b";
  if (freq >= 4) return "#08519c";
  if (freq >= 3) return "#3182bd";
  if (freq >= 2) return "#6baed6";
  if (freq >= 1) return "#c6dbef";
  return "#f0f0e8";
};

/**
 * Choropleth map using TiPG vector tiles for admin boundaries.
 * Shades countries by event frequency / risk score per hazard.
 */
export function ChoroplethMap({ regions, adminLevel = 0, colorScheme = "drought", compact = false }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [basemap, setBasemap] = useState<"osm" | "satellite">("osm");
  const [hoverInfo, setHoverInfo] = useState<{
    lng: number; lat: number; name: string; group: string; val: number;
  } | null>(null);

  const collection = `admin${adminLevel}_boundaries`;
  const tileUrl = vectorTileUrl(collection);
  const colorFn = colorScheme === "flood" ? FLOOD_COLORS : DROUGHT_COLORS;

  // Build intensity lookup
  const intensityMap = useMemo(() => {
    const map = new Map<string, { frequency: number; name: string }>();
    regions.forEach((r) => map.set(r.shapeGroup, { frequency: r.frequency, name: r.shapeName }));
    return map;
  }, [regions]);

  // Build fill-color match expression
  const fillColor = useMemo((): any => {
    if (regions.length === 0) return "#f0f0e8";
    const expr: any[] = ["match", ["get", "iso3"]];
    regions.forEach((r) => expr.push(r.shapeGroup, colorFn(r.frequency)));
    expr.push("#f0f0e8");
    return expr;
  }, [regions, colorFn]);

  // Build fill-opacity match expression
  const fillOpacity = useMemo((): any => {
    if (regions.length === 0) return 0.4;
    const expr: any[] = ["match", ["get", "iso3"]];
    regions.forEach((r) => expr.push(r.shapeGroup, 0.75));
    expr.push(0.25);
    return expr;
  }, [regions]);

  // Build mapStyle with vector tile source embedded
  const mapStyle = useMemo(() => {
    const baseTiles = basemap === "satellite"
      ? ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"]
      : ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];

    return {
      version: 8 as const,
      sources: {
        base: { type: "raster" as const, tiles: baseTiles, tileSize: 256 },
        admin: {
          type: "vector" as const,
          tiles: [tileUrl],
          minzoom: 0,
          maxzoom: 14,
        },
      },
      layers: [
        { id: "base", type: "raster" as const, source: "base" },
        {
          id: "admin-fill",
          type: "fill" as const,
          source: "admin",
          "source-layer": "default",
          paint: {
            "fill-color": fillColor,
            "fill-opacity": fillOpacity,
          },
        },
        {
          id: "admin-border",
          type: "line" as const,
          source: "admin",
          "source-layer": "default",
          paint: { "line-color": "#444", "line-width": 0.8 },
        },
      ],
    };
  }, [basemap, tileUrl, fillColor, fillOpacity]);

  const onHover = useCallback((e: MapLayerMouseEvent) => {
    const feat = e.features?.[0];
    if (feat?.properties) {
      const iso3 = feat.properties.iso3 || "";
      const region = intensityMap.get(iso3);
      // For admin1+, show province name with country context
      const name = adminLevel >= 1 && feat.properties.name_1
        ? `${feat.properties.name_1}, ${feat.properties.country || iso3}`
        : feat.properties.country || iso3;
      setHoverInfo({ lng: e.lngLat.lng, lat: e.lngLat.lat, name, group: iso3, val: region?.frequency || 0 });
    } else {
      setHoverInfo(null);
    }
  }, [intensityMap, adminLevel]);

  const severityLabel = (val: number) => {
    if (val >= 6) return "Critical";
    if (val >= 4) return "Extreme";
    if (val >= 3) return "Severe";
    if (val >= 2) return "High";
    if (val >= 1) return "Moderate";
    return "None";
  };

  const height = compact ? "h-[380px]" : "h-[420px]";

  return (
    <div className={`relative ${height} w-full rounded-lg overflow-hidden`}>
      {!compact && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {(["osm", "satellite"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBasemap(b)}
              className={`rounded px-2 py-1 text-xs font-medium shadow transition-colors ${
                basemap === b ? "bg-white text-gray-900" : "bg-black/50 text-white hover:bg-black/70"
              }`}
            >
              {b === "osm" ? "OSM" : "Satellite"}
            </button>
          ))}
        </div>
      )}

      <MapGL
        ref={mapRef}
        initialViewState={IGAD_BOUNDS}
        mapStyle={mapStyle}
        interactiveLayerIds={["admin-fill"]}
        onMouseMove={onHover}
        onMouseLeave={() => setHoverInfo(null)}
        cursor={hoverInfo ? "pointer" : "grab"}
      >
        {!compact && <NavigationControl position="top-left" />}

        {hoverInfo && (
          <Popup longitude={hoverInfo.lng} latitude={hoverInfo.lat} closeButton={false} closeOnClick={false} anchor="bottom" offset={8}>
            <div className="text-sm">
              <strong>{hoverInfo.name}</strong> ({hoverInfo.group})
              <div className="text-xs mt-0.5">
                Risk: <span className="font-semibold">{severityLabel(hoverInfo.val)}</span>
                {hoverInfo.val > 0 && <span className="ml-1 text-gray-400">({hoverInfo.val} events)</span>}
              </div>
            </div>
          </Popup>
        )}
      </MapGL>
    </div>
  );
}
