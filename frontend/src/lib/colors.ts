import { scaleThreshold } from "d3-scale";

export const eventColorScale = scaleThreshold<number, string>()
  .domain([1, 2, 4, 6, 8, 10])
  .range(["#e8e8e8", "#ffffcc", "#fed976", "#ffb24b", "#fd4e2a", "#e3181a", "#800026"]);

// Drought: warm red/orange tones — saturated ramp
export const droughtColorScale = scaleThreshold<number, string>()
  .domain([1, 2, 4, 6, 8, 10])
  .range(["#f5f5f5", "#fee0d2", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#67000d"]);

// Flood: cool blue tones — saturated ramp
export const floodColorScale = scaleThreshold<number, string>()
  .domain([1, 2, 3, 4, 5])
  .range(["#f5f5f5", "#c6dbef", "#6baed6", "#3182bd", "#08519c", "#08306b"]);

export function getColorScale(scheme?: "drought" | "flood") {
  if (scheme === "drought") return droughtColorScale;
  if (scheme === "flood") return floodColorScale;
  return eventColorScale;
}

export const HAZARD_COLORS = {
  drought: "#e3181a",
  flood: "#3273dc",
} as const;

export type HazardType = "drought" | "flood";
