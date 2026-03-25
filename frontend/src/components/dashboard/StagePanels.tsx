'use client';

import React from 'react';
import { usePipelineStore } from '@/store/pipeline-context';
import type { PipelineStage } from '@/types/pipeline';
import { getCalendarConfig } from '@/types/pipeline';

const copy: Record<PipelineStage, { title: string; body: string }> = {
  'risk-knowledge': {
    title: 'Risk Knowledge',
    body: 'Historical disaster events and storylines from the EM-DAT database. Monthly calendar view spanning 1990–2025 for drought and flood hazards.',
  },
  'risk-monitoring': {
    title: 'Risk Monitoring',
    body: 'Ensemble forecasts, observational thresholds, and situational monitoring. Flood uses daily resolution (2022–2026), drought uses monthly (1981–2026).',
  },
  'risk-decisions': {
    title: 'Risk Decisions',
    body: 'Risk evaluation and impact-based forecasting for the current year. Daily resolution calendar for actionable decision windows.',
  },
};

export function StagePanels() {
  const { stage, hazard } = usePipelineStore();
  const config = getCalendarConfig(stage, hazard);

  return (
    <div className="rounded-xl bg-slate-900 p-4 text-white shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            {hazard === 'drought' ? 'Drought' : 'Flood'} — {copy[stage].title}
          </p>
          <h3 className="text-lg font-bold mt-0.5">{copy[stage].title}</h3>
        </div>
        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">
          {config.mode} · {config.startYear}–{config.endYear}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-300">{copy[stage].body}</p>
    </div>
  );
}
