'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PipelineChips } from '@/components/dashboard/PipelineChips';
import { StagePanels } from '@/components/dashboard/StagePanels';
import { CalendarHeatmap } from '@/components/calendar/calendar-heatmap';
import type { CalendarSelection } from '@/components/calendar/calendar-heatmap';
import { DisasterMap } from '@/components/dashboard/DisasterMap';
import { fetchEmdatMonthlyRisk } from '@/lib/api/emdat';
import { usePipelineStore } from '@/store/pipeline-context';
import { getCalendarConfig } from '@/types/pipeline';
import type { EmdatMonthDatum } from '@/types/emdat';
import { BookOpen, ArrowRight, Globe } from 'lucide-react';

const MarkdownPanel = dynamic(
  () => import('@/components/dashboard/MarkdownPanel').then((m) => m.MarkdownPanel),
  { ssr: false }
);

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function DashboardShell() {
  const {
    hazard,
    stage,
    selectedMonth: pipelineMonth,
    setHazard,
    setSelectedMonth,
    setSelectedEventKey,
  } = usePipelineStore();

  const calendarConfig = getCalendarConfig(stage, hazard);
  const isRK = stage === 'risk-knowledge';

  const [showAllMap, setShowAllMap] = useState(false);
  const [calendarData, setCalendarData] = useState<EmdatMonthDatum[]>([]);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [timeLabel, setTimeLabel] = useState<string | null>(null);

  // Fetch calendar data
  useEffect(() => {
    setSelectedCell(null);
    setTimeLabel(null);
    setShowAllMap(false);

    if (isRK) {
      fetchEmdatMonthlyRisk(hazard)
        .then((data) => {
          const filtered = data.filter(
            (d) => d.year >= calendarConfig.startYear && d.year <= calendarConfig.endYear
          );
          setCalendarData(filtered);
        })
        .catch((err) => console.error('Failed to fetch calendar data', err));
    } else {
      const synthetic: EmdatMonthDatum[] = [];
      for (let y = calendarConfig.startYear; y <= calendarConfig.endYear; y++) {
        for (let m = 1; m <= 12; m++) {
          synthetic.push({
            event_key: `${hazard}-${y}-${String(m).padStart(2, '0')}`,
            year: y, month: m, event_count: 1,
            total_deaths: 0, total_affected: 0,
            regions_affected: 0, countries_affected: 0, level: 1,
          });
        }
      }
      setCalendarData(synthetic);
    }
  }, [hazard, stage, isRK, calendarConfig.startYear, calendarConfig.endYear]);

  const onCellSelect = useCallback(
    (sel: CalendarSelection | null) => {
      if (!sel) {
        setSelectedCell(null);
        setTimeLabel(null);
        setSelectedEventKey(null);
        setSelectedMonth(null);
        return;
      }
      const cellKey = `${sel.year}-${String(sel.month).padStart(2, '0')}`;
      const urlKey = sel.dateKey || cellKey;
      setSelectedCell(cellKey);
      setSelectedEventKey(sel.eventKey);
      setSelectedMonth(urlKey);
      setTimeLabel(urlKey.length === 10 ? urlKey : `${MONTHS_SHORT[sel.month - 1]} ${sel.year}`);
    },
    [setSelectedEventKey, setSelectedMonth]
  );

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">CRMA</p>
          <h1 className="text-3xl font-bold">Continuous Risk Monitoring & Assessment</h1>
          <p className="mt-1 text-gray-500">
            Explore disaster events, monitor hazard risk, and access impact-based forecasts
            for flood and drought across East Africa.
          </p>
        </div>

        {/* Hazard Chips */}
        <div className="grid grid-cols-2 gap-3 max-w-2xl">
          {([
            { id: 'drought' as const, label: 'Drought', desc: 'Monthly BN outlook + EM-DAT events' },
            { id: 'flood' as const, label: 'Flood', desc: 'Daily CRMA outlook + EM-DAT events' },
          ]).map((item) => (
            <button
              key={item.id}
              onClick={() => setHazard(item.id)}
              className={`rounded-lg px-5 py-3 text-left transition-all ${
                hazard === item.id
                  ? item.id === 'drought'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="block text-sm font-bold">{item.label}</span>
              <span className={`block text-xs mt-0.5 ${hazard === item.id ? 'text-white/70' : 'text-gray-400'}`}>
                {item.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Pipeline Stage Chips */}
        <div className="mt-4">
          <PipelineChips />
        </div>

        {/* Stage Info Panel */}
        <div className="mt-4">
          <StagePanels />
        </div>

        {/* Calendar + Choropleth */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Calendar */}
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  {hazard === 'drought' ? 'Drought' : 'Flood'} — EM-DAT Disaster Events
                </p>
                <h3 className="text-sm font-semibold text-gray-700">
                  {calendarConfig.mode === 'monthly' ? 'Monthly' : 'Daily'} Event Frequency ({calendarConfig.startYear}–{calendarConfig.endYear})
                </h3>
              </div>
              {timeLabel && (
                <button
                  onClick={() => onCellSelect(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Reset
                </button>
              )}
            </div>
            <CalendarHeatmap
              data={calendarData}
              startYear={calendarConfig.startYear}
              endYear={calendarConfig.endYear}
              selectedCell={selectedCell}
              onSelectCell={(sel) => {
                setShowAllMap(false);
                onCellSelect(sel);
              }}
              colorScheme={hazard}
              mode={calendarConfig.mode}
              synthetic={!isRK}
            />
          </div>

          {/* Choropleth Map */}
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Affected Regions</p>
                <h3 className="text-sm font-semibold text-gray-700">Admin1 Frequency Choropleth</h3>
              </div>
              <button
                onClick={() => setShowAllMap(!showAllMap)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  showAllMap
                    ? 'bg-slate-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                {showAllMap ? 'All Events' : 'All Events'}
              </button>
            </div>
            <DisasterMap mode={showAllMap ? 'all' : pipelineMonth ? 'event' : 'empty'} />
          </div>
        </div>

        {/* MDX Event Detail Panel — only in monthly mode */}
        {!showAllMap && pipelineMonth && (
          <div className="mt-6">
            <MarkdownPanel />
          </div>
        )}

        {/* Storyline CTA */}
        <div className="mt-8 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-gray-700/60 p-8 shadow-lg">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-blue-400" />
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Disaster Storylines
                </p>
              </div>
              <h3 className="text-xl font-bold text-white">
                Explore East Africa {hazard === 'drought' ? 'Drought' : 'Flood'} Storylines
              </h3>
              <p className="mt-2 text-sm text-gray-400 max-w-lg">
                Scroll-driven narratives with satellite imagery mapping country-by-country
                impacts across the Greater Horn of Africa.
              </p>
            </div>
            <Link
              href="/storylines"
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg"
            >
              View Storylines
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
