'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import { usePipelineStore } from '@/store/pipeline-context';
import { fetchEmdatMonthRegions } from '@/lib/api/emdat';
import type { EmdatRegionDatum } from '@/types/emdat';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { getColorScale } from '@/lib/colors';

export function DisasterMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useResizeObserver(containerRef as React.RefObject<HTMLElement>, 500, 420);
  const { selectedEventKey, hazard } = usePipelineStore();
  const [regions, setRegions] = useState<EmdatRegionDatum[]>([]);
  const [topology, setTopology] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const colorScale = useMemo(() => getColorScale(hazard), [hazard]);

  useEffect(() => {
    if (topology) return;
    fetch('/data/icpac_adm1v3.json')
      .then((res) => res.json())
      .then(setTopology)
      .catch((err) => console.error('Failed to load Admin1 topojson', err));
  }, [topology]);

  useEffect(() => {
    if (!selectedEventKey) {
      setRegions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchEmdatMonthRegions(selectedEventKey)
      .then((payload) => {
        if (!cancelled) setRegions(payload);
      })
      .catch(() => {
        if (!cancelled) setRegions([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [selectedEventKey]);

  const intensityById = useMemo(() => {
    const map = new Map<string, number>();
    regions.forEach((r) => map.set(r.shapeID, r.frequency));
    return map;
  }, [regions]);

  useEffect(() => {
    if (!svgRef.current || !topology) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const topo = topology as { objects: Record<string, unknown> };
    const objectKey = Object.keys(topo.objects)[0];
    const geojson = feature(topo as Parameters<typeof feature>[0], topo.objects[objectKey] as Parameters<typeof feature>[1]);
    const height = 420;
    const projection = d3.geoMercator().fitSize([width, height], geojson as d3.GeoPermissibleObjects);
    const path = d3.geoPath(projection);

    svg.attr('width', width).attr('height', height);

    const features = (geojson as GeoJSON.FeatureCollection).features;
    svg.append('g')
      .selectAll('path')
      .data(features)
      .enter().append('path')
      .attr('d', (d) => path(d) || '')
      .attr('fill', (d) => {
        const props = d.properties as Record<string, string>;
        const value = intensityById.get(props.GID_1) ?? 0;
        return colorScale(value);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .append('title')
      .text((d) => {
        const props = d.properties as Record<string, string>;
        const value = intensityById.get(props.GID_1) ?? 0;
        return `${props.NAME_1 || props.GID_1} — ${value} events`;
      });

    svg.append('path')
      .datum(d3.geoGraticule10())
      .attr('d', (d) => path(d) || '')
      .attr('fill', 'none')
      .attr('stroke', 'rgba(0,0,0,0.06)')
      .attr('stroke-width', 0.5);
  }, [intensityById, topology, width, colorScale]);

  return (
    <div ref={containerRef} className="w-full">
      {loading && (
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Loading</span>
      )}
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
