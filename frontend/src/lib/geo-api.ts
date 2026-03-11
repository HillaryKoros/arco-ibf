/**
 * E4DRR Geo API client.
 * Proxied via Next.js rewrites: /geo/* → geoapi:8080
 *
 * Two layers:
 * 1. OGC endpoints (TiPG): /geo/collections/* — vector tiles + features
 * 2. Custom endpoints:      /geo/api/*        — calendar, choropleth, bbox
 */

const GEO_BASE = "/geo";

// ── Custom domain endpoints (FastAPI) ───────────────────────────────────────

/** Calendar heatmap data — monthly aggregation from SQL function */
export async function getCalendarData(hazard: "drought" | "flood") {
  const res = await fetch(`${GEO_BASE}/api/calendar?hazard=${hazard}`);
  const rows = await res.json();
  return rows.map((r: Record<string, unknown>) => ({
    year: r.year as number,
    month: r.month as number,
    event_count: r.event_count as number,
    event_key: ((r.event_keys as string[]) || [])[0] || "",
    total_deaths: (r.total_deaths as number) || 0,
    total_affected: (r.total_affected as number) || 0,
    regions_affected: ((r.countries as string[]) || []).length,
    countries_affected: ((r.countries as string[]) || []).length,
    level:
      r.max_severity === "extreme" ? 4
      : r.max_severity === "severe" ? 3
      : r.max_severity === "high" ? 2
      : 1,
  }));
}

/** Choropleth regions — country frequency for a hazard, optionally filtered by time */
export async function getChoroplethRegions(
  hazard: "drought" | "flood",
  opts?: { eventKey?: string; year?: number; month?: number }
) {
  const params = new URLSearchParams({ hazard });
  if (opts?.eventKey) params.set("event_key", opts.eventKey);
  if (opts?.year != null) params.set("year", String(opts.year));
  if (opts?.month != null) params.set("month", String(opts.month));
  const res = await fetch(`${GEO_BASE}/api/choropleth?${params}`);
  const rows = await res.json();
  return rows.map((r: Record<string, unknown>) => ({
    shapeID: r.shapeGroup as string,
    shapeName: r.shapeName as string,
    shapeGroup: r.shapeGroup as string,
    frequency: Number(r.frequency) || 1,
  }));
}

/** Country bounding box for map fitBounds */
export async function getCountryBbox(iso3: string) {
  const res = await fetch(`${GEO_BASE}/api/bbox/${iso3}`);
  const data = await res.json();
  if (!data) return null;
  return data as { iso3: string; country: string; minx: number; miny: number; maxx: number; maxy: number };
}

/** All hazard events */
export async function getHazardEvents(hazard: "drought" | "flood") {
  const res = await fetch(`${GEO_BASE}/api/events?hazard=${hazard}`);
  return res.json();
}

// ── OGC endpoints (TiPG router) ────────────────────────────────────────────

/** OGC API - Features: list collections */
export async function listCollections() {
  const res = await fetch(`${GEO_BASE}/collections?f=json`);
  return res.json();
}

/** OGC API - Features: get items from a collection */
export async function getFeatures(
  collection: string,
  params?: {
    limit?: number;
    offset?: number;
    bbox?: [number, number, number, number];
    filter?: string;
    properties?: string[];
    sortby?: string;
  }
) {
  const col = collection.startsWith("public.") ? collection : `public.${collection}`;
  const url = new URL(`${GEO_BASE}/collections/${col}/items`, window.location.origin);
  url.searchParams.set("f", "geojson");
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));
  if (params?.bbox) url.searchParams.set("bbox", params.bbox.join(","));
  if (params?.filter) url.searchParams.set("filter", params.filter);
  if (params?.properties) url.searchParams.set("properties", params.properties.join(","));
  if (params?.sortby) url.searchParams.set("sortby", params.sortby);
  const res = await fetch(url.toString());
  return res.json();
}

/** Get admin boundaries at specified level */
export async function getAdminBoundaries(level: 0 | 1 | 2, iso3?: string) {
  const collection = `admin${level}_boundaries`;
  const filter = iso3 ? `iso3='${iso3}'` : undefined;
  return getFeatures(collection, { filter, limit: 1000 });
}

/** Get admin1 boundaries for a country */
export async function getCountryAdmin1(iso3: string) {
  const res = await fetch(`${GEO_BASE}/collections/public.country_admin1/items?p_iso3=${iso3}&f=json&limit=200`);
  return res.json();
}

// ── Tile URL helpers ────────────────────────────────────────────────────────

/** Vector tile URL template for MapLibre */
export function vectorTileUrl(collection: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${GEO_BASE}/collections/public.${collection}/tiles/WebMercatorQuad/{z}/{x}/{y}`;
}

/** TileJSON URL for a collection */
export function tileJsonUrl(collection: string): string {
  const col = collection.startsWith("public.") ? collection : `public.${collection}`;
  return `${GEO_BASE}/collections/${col}/tiles?f=json`;
}
