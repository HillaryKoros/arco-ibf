'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import { usePipelineStore } from '@/store/pipeline-context';
import { fetchEmdatMonthRegions, fetchEmdatAllRegions } from '@/lib/api/emdat';
import type { EmdatRegionDatum } from '@/types/emdat';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { getColorScale } from '@/lib/colors';

interface Props {
  mode: 'all' | 'event' | 'empty';
}

export function DisasterMap({ mode }: Props) {
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

  // Fetch regions based on mode
  useEffect(() => {
    if (mode === 'empty') {
      setRegions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    if (mode === 'all') {
      fetchEmdatAllRegions(hazard)
        .then((payload) => { if (!cancelled) setRegions(payload); })
        .catch(() => { if (!cancelled) setRegions([]); })
        .finally(() => !cancelled && setLoading(false));
    } else {
      if (!selectedEventKey) {
        setRegions([]);
        setLoading(false);
        return;
      }
      fetchEmdatMonthRegions(selectedEventKey)
        .then((payload) => { if (!cancelled) setRegions(payload); })
        .catch(() => { if (!cancelled) setRegions([]); })
        .finally(() => !cancelled && setLoading(false));
    }

    return () => { cancelled = true; };
  }, [mode, hazard, selectedEventKey]);

  const intensityById = useMemo(() => {
    const map = new Map<string, number>();
    regions.forEach((r) => map.set(r.shapeID, r.frequency));
    return map;
  }, [regions]);

  // Summary stats for "all" mode
  const summary = useMemo(() => {
    if (mode !== 'all' || regions.length === 0) return null;
    const totalEvents = regions.reduce((a, r) => a + (r.frequency || 0), 0);
    const countries = new Set(regions.map((r) => r.shapeGroup)).size;
    return { totalEvents, countries, regions: regions.length };
  }, [mode, regions]);

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

    // Tooltip div
    let tooltip = d3.select('#crma-map-tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div')
        .attr('id', 'crma-map-tooltip')
        .style('position', 'fixed')
        .style('pointer-events', 'none')
        .style('background', 'rgba(15,23,42,0.92)')
        .style('color', '#fff')
        .style('padding', '6px 10px')
        .style('border-radius', '6px')
        .style('font-size', '12px')
        .style('line-height', '1.4')
        .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
        .style('z-index', '9999')
        .style('display', 'none');
    }

    const features = (geojson as GeoJSON.FeatureCollection).features;
    svg.append('g')
      .selectAll('path')
      .data(features)
      .enter().append('path')
      .attr('d', (d) => path(d) || '')
      .attr('fill', (d) => {
        const props = d.properties as Record<string, string>;
        const value = intensityById.get(props.GID_1) ?? 0;
        if (value === 0) return 'none';
        return colorScale(value);
      })
      .attr('stroke', '#999')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const props = d.properties as Record<string, string>;
        const gid = props.GID_1;
        const value = intensityById.get(gid) ?? 0;
        const name = props.NAME_1 || gid;
        const country = gid.split('.')[0];
        d3.select(event.currentTarget).attr('stroke', '#000').attr('stroke-width', 1.5);
        tooltip
          .style('display', 'block')
          .html(`<strong>${name}</strong> (${country})<br/>${value} event${value !== 1 ? 's' : ''}`);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 10}px`);
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).attr('stroke', '#fff').attr('stroke-width', 0.5);
        tooltip.style('display', 'none');
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
      {summary && (
        <div className="flex gap-4 mb-3 text-xs text-gray-500">
          <span><strong className="text-gray-800">{summary.totalEvents}</strong> events</span>
          <span><strong className="text-gray-800">{summary.countries}</strong> countries</span>
          <span><strong className="text-gray-800">{summary.regions}</strong> admin1 regions</span>
        </div>
      )}
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
