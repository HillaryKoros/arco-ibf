'use client';

import React, { useEffect, useState } from 'react';
import { MDXRemote, type MDXRemoteSerializeResult } from 'next-mdx-remote';
import { usePipelineStore } from '@/store/pipeline-context';
import {
  CountryHeader,
  ImpactStats,
  Hero,
  StatGrid,
  Stat,
  Block,
  Prose,
} from '@/components/storyline/story-ui';

const mdxComponents = {
  CountryHeader,
  ImpactStats,
  Hero,
  StatGrid,
  Stat,
  Block,
  Prose,
};

interface EventMdxResult {
  meta: {
    id: string;
    name: string;
    hazard: string;
    tab: string;
    period: string;
    severity: string;
  };
  mdxSource: MDXRemoteSerializeResult;
}

export function MarkdownPanel() {
  const { selectedMonth, hazard, stage } = usePipelineStore();
  const [eventData, setEventData] = useState<EventMdxResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMonth) {
      setEventData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/event-mdx?hazard=${hazard}&stage=${stage}&period=${encodeURIComponent(selectedMonth)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Not found: ${res.status}`);
        return res.json();
      })
      .then((data: EventMdxResult) => {
        if (!cancelled) setEventData(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setEventData(null);
          setError(err.message);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, hazard, stage]);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-gray-700/60 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Event Detail
          </p>
          <h3 className="text-lg font-bold text-white">
            {eventData
              ? eventData.meta.name
              : selectedMonth
                ? `${selectedMonth} — ${hazard}`
                : 'Select a calendar cell'}
          </h3>
        </div>
        {loading && (
          <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full border border-amber-500/30">
            Loading
          </span>
        )}
      </div>

      {eventData ? (
        <article className="prose prose-invert prose-sm max-w-none max-h-[60vh] overflow-y-auto">
          <MDXRemote {...eventData.mdxSource} components={mdxComponents} />
        </article>
      ) : error ? (
        <p className="text-sm text-gray-500">
          No storyline available for this event.
        </p>
      ) : (
        <p className="text-sm text-gray-500">
          Choose a calendar cell to view event details.
        </p>
      )}
    </div>
  );
}
