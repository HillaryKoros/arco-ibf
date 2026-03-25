'use client';

import React from 'react';
import { usePipelineStore } from '@/store/pipeline-context';
import type { PipelineStage } from '@/types/pipeline';

const stages: { key: PipelineStage; label: string; desc: string }[] = [
  {
    key: 'risk-knowledge',
    label: 'Risk Knowledge',
    desc: 'Historical EM-DAT events & storylines',
  },
  {
    key: 'risk-monitoring',
    label: 'Risk Monitoring',
    desc: 'Forecasts, thresholds & observations',
  },
  {
    key: 'risk-decisions',
    label: 'Risk Decisions',
    desc: 'Risk evaluation & impact-based forecasting',
  },
];

export function PipelineChips() {
  const { stage, setStage } = usePipelineStore();

  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((s) => (
        <button
          key={s.key}
          onClick={() => setStage(s.key)}
          className={`rounded-lg px-4 py-2.5 text-left transition-all ${
            stage === s.key
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="block text-sm font-semibold">{s.label}</span>
          <span
            className={`block text-xs mt-0.5 ${
              stage === s.key ? 'text-indigo-200' : 'text-gray-400'
            }`}
          >
            {s.desc}
          </span>
        </button>
      ))}
    </div>
  );
}
