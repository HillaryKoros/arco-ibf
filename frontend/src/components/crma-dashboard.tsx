"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { HazardToggle } from "@/components/ui/hazard-toggle";
import { CalendarHeatmap } from "@/components/calendar/calendar-heatmap";
import type { CalendarSelection } from "@/components/calendar/calendar-heatmap";
import { getCalendarData, getChoroplethRegions } from "@/lib/geo-api";
import type { CalendarEvent, Region } from "@/lib/api";
import type { HazardType } from "@/lib/colors";
import type { MDXRemoteSerializeResult } from "next-mdx-remote";
import {
  AlertTriangle, Globe, TrendingUp,
  Sun, Droplets, Calendar,
} from "lucide-react";

const ChoroplethMap = dynamic(
  () => import("@/components/map/choropleth-map").then((m) => m.ChoroplethMap),
  { ssr: false, loading: () => <div className="flex h-[380px] items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">Loading map...</div> }
);

const StorylinePanel = dynamic(
  () => import("@/components/storyline/storyline-panel").then((m) => m.StorylinePanel),
  { ssr: false, loading: () => <div className="mt-8 h-[60vh] flex items-center justify-center bg-gray-100 rounded-lg">Loading storylines...</div> }
);

interface StoryData {
  slug: string;
  name: string;
  description: string;
  hazard: string;
  mdxSource: MDXRemoteSerializeResult;
}

interface Props {
  stories: StoryData[];
}

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function CRMADashboard({ stories }: Props) {
  const [hazard, setHazard] = useState<HazardType | null>(null);
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null);

  // Calendar data
  const [droughtData, setDroughtData] = useState<CalendarEvent[]>([]);
  const [floodData, setFloodData] = useState<CalendarEvent[]>([]);

  // Choropleth regions
  const [droughtRegions, setDroughtRegions] = useState<Region[]>([]);
  const [floodRegions, setFloodRegions] = useState<Region[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  // Synced timeline selection (shared between both calendars on default view)
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [timeLabel, setTimeLabel] = useState<string | null>(null);

  // Fetch all data on mount
  useEffect(() => {
    getCalendarData("drought").then(setDroughtData);
    getCalendarData("flood").then(setFloodData);
    getChoroplethRegions("drought").then(setDroughtRegions);
    getChoroplethRegions("flood").then(setFloodRegions);
  }, []);

  // Event counts
  const droughtEventCount = useMemo(() => new Set(droughtData.map(d => d.event_key)).size, [droughtData]);
  const floodEventCount = useMemo(() => new Set(floodData.map(d => d.event_key)).size, [floodData]);

  // ── Default view: synced timeline handler ──
  const onTimelineSelect = useCallback((sel: CalendarSelection | null) => {
    if (!sel) {
      setSelectedCell(null);
      setTimeLabel(null);
      // Reset to all-time data
      getChoroplethRegions("drought").then(setDroughtRegions);
      getChoroplethRegions("flood").then(setFloodRegions);
      return;
    }

    const cellKey = `${sel.year}-${String(sel.month).padStart(2, "0")}`;
    setSelectedCell(cellKey);
    setTimeLabel(`${MONTHS_SHORT[sel.month - 1]} ${sel.year}`);

    // Update both maps for this year/month
    getChoroplethRegions("drought", { year: sel.year, month: sel.month }).then(setDroughtRegions);
    getChoroplethRegions("flood", { year: sel.year, month: sel.month }).then(setFloodRegions);
  }, []);

  // ── Selected hazard view ──
  const activeData = hazard === "drought" ? droughtData : hazard === "flood" ? floodData : null;
  const activeEventCount = hazard === "drought" ? droughtEventCount : floodEventCount;

  // Fetch regions when hazard is selected
  useEffect(() => {
    setSelectedEventKey(null);
    setSelectedCell(null);
    setTimeLabel(null);
    if (!hazard) return;
    getChoroplethRegions(hazard).then(setRegions);
  }, [hazard]);

  // Sync single-hazard choropleth when calendar cell is clicked
  const onHazardCellSelect = useCallback((sel: CalendarSelection | null) => {
    if (!sel || !hazard) {
      setSelectedEventKey(null);
      setSelectedCell(null);
      setTimeLabel(null);
      setRegions([]);
      return;
    }

    const cellKey = `${sel.year}-${String(sel.month).padStart(2, "0")}`;
    setSelectedCell(cellKey);
    setSelectedEventKey(sel.eventKey);
    setTimeLabel(`${MONTHS_SHORT[sel.month - 1]} ${sel.year}`);

    if (sel.hasEvents) {
      getChoroplethRegions(hazard, { year: sel.year, month: sel.month }).then(setRegions);
    } else {
      setRegions([]);
    }
  }, [hazard]);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Continuous Risk Monitoring & Assessment
          </p>
          <h1 className="text-3xl font-bold">
            {hazard
              ? `CRMA — ${hazard === "drought" ? "Drought" : "Flood"} Events`
              : "CRMA — Flood & Drought Events"}
          </h1>
          <p className="mt-1 text-gray-500">
            {hazard
              ? `Viewing ${hazard} disaster events, affected regions, and storylines across the Greater Horn of Africa.`
              : "Explore EM-DAT disaster events, view affected regions, and read scroll-driven storylines across the Greater Horn of Africa."}
          </p>
        </div>

        {/* Hazard Toggle */}
        <HazardToggle value={hazard} onChange={setHazard} />

        {/* ══════════════════════════════════════════════════════════════
            DEFAULT VIEW: Compare maps + synced timeline
           ══════════════════════════════════════════════════════════════ */}
        {!hazard && (
          <div className="mt-6 space-y-6">
            {/* Time filter indicator */}
            {timeLabel && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <Calendar className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  Showing events for <strong>{timeLabel}</strong>
                </span>
                <button
                  onClick={() => onTimelineSelect(null)}
                  className="ml-auto text-xs text-amber-600 hover:text-amber-800 underline"
                >
                  Reset to all time
                </button>
              </div>
            )}

            {/* Compare Maps */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-gray-200/60 p-6 shadow-lg">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-800">Hazard Risk Comparison</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Country risk scores by event frequency — click a calendar cell below to filter by time period
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Drought map */}
                <div className="rounded-xl bg-white shadow-sm border border-red-100 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50/50 border-b border-red-100">
                    <Sun className="h-4 w-4 text-red-500" />
                    <h3 className="text-sm font-semibold text-gray-700">Drought Risk</h3>
                    <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                      {droughtRegions.length > 0
                        ? `${droughtRegions.length} countries`
                        : "No events"}
                    </span>
                  </div>
                  <ChoroplethMap regions={droughtRegions} adminLevel={0} colorScheme="drought" compact />
                </div>

                {/* Flood map */}
                <div className="rounded-xl bg-white shadow-sm border border-blue-100 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50/50 border-b border-blue-100">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-700">Flood Risk</h3>
                    <span className="ml-auto text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      {floodRegions.length > 0
                        ? `${floodRegions.length} countries`
                        : "No events"}
                    </span>
                  </div>
                  <ChoroplethMap regions={floodRegions} adminLevel={0} colorScheme="flood" compact />
                </div>
              </div>
            </div>

            {/* Synced Calendar Timeline */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-gray-200/60 p-6 shadow-lg">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-800">Event Timeline</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Click any cell to filter both maps to that month — both drought and flood update together
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-xl bg-white p-4 shadow-sm border border-red-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Sun className="h-4 w-4 text-red-500" />
                    <h3 className="text-sm font-semibold text-gray-700">Drought</h3>
                    <span className="ml-auto text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      {droughtEventCount} events
                    </span>
                  </div>
                  <CalendarHeatmap
                    data={droughtData}
                    startYear={2019}
                    endYear={2025}
                    selectedCell={selectedCell}
                    onSelectCell={onTimelineSelect}
                    colorScheme="drought"
                  />
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm border border-blue-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-700">Flood</h3>
                    <span className="ml-auto text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {floodEventCount} events
                    </span>
                  </div>
                  <CalendarHeatmap
                    data={floodData}
                    startYear={2019}
                    endYear={2025}
                    selectedCell={selectedCell}
                    onSelectCell={onTimelineSelect}
                    colorScheme="flood"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SELECTED HAZARD VIEW: single map + calendar synced
           ══════════════════════════════════════════════════════════════ */}
        {hazard && activeData && (
          <>
            {/* Summary Cards */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs uppercase">Events</span>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {regions.length > 0 ? activeEventCount : <span className="text-gray-300">—</span>}
                </p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Globe className="h-4 w-4" />
                  <span className="text-xs uppercase">Countries</span>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {regions.length > 0 ? regions.length : <span className="text-gray-300">—</span>}
                </p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  {hazard === "drought" ? <Sun className="h-4 w-4" /> : <Droplets className="h-4 w-4" />}
                  <span className="text-xs uppercase">Hazard</span>
                </div>
                <p className="mt-1 text-2xl font-bold capitalize">{hazard}</p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs uppercase">Period</span>
                </div>
                <p className="mt-1 text-lg font-bold">
                  {timeLabel || <span className="text-gray-300">All time</span>}
                </p>
              </div>
            </div>

            {/* Calendar + Choropleth */}
            <div className="mt-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-gray-200/60 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    {hazard === "drought" ? "Drought" : "Flood"} Events
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Click a calendar cell to filter the map — empty cells clear the map
                  </p>
                </div>
                {timeLabel && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-amber-50 text-amber-700 font-medium px-3 py-1 rounded-full border border-amber-200">
                      {timeLabel}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedCell(null);
                        setTimeLabel(null);
                        setSelectedEventKey(null);
                        getChoroplethRegions(hazard).then(setRegions);
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">Monthly Event Frequency</h3>
                  <CalendarHeatmap
                    data={activeData}
                    startYear={2019}
                    endYear={2025}
                    selectedCell={selectedCell}
                    onSelectCell={onHazardCellSelect}
                    colorScheme={hazard}
                  />
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">Affected Regions</h3>
                  <ChoroplethMap regions={regions} adminLevel={1} colorScheme={hazard} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Storyline — only when a hazard is selected */}
      {hazard && <StorylinePanel stories={stories} hazard={hazard} />}
    </>
  );
}
