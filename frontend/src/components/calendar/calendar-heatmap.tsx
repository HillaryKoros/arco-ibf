"use client";

import { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import { getColorScale } from "@/lib/colors";
import type { CalendarEvent } from "@/lib/api";

export interface CalendarSelection {
  year: number;
  month: number;
  eventKey: string | null;
  hasEvents: boolean;
}

interface Props {
  data: CalendarEvent[];
  startYear: number;
  endYear: number;
  /** Currently selected cell key "YYYY-MM" for highlighting */
  selectedCell: string | null;
  onSelectCell: (sel: CalendarSelection | null) => void;
  colorScheme?: "drought" | "flood";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function CalendarHeatmap({ data, startYear, endYear, selectedCell, onSelectCell, colorScheme }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    data.forEach((item) => {
      const key = `${item.year}-${String(item.month).padStart(2, "0")}`;
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = containerRef.current.clientWidth;
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) years.push(y);

    const pad = { top: 32, right: 16, bottom: 16, left: 50 };
    const cellW = Math.max(36, (width - pad.left - pad.right) / years.length);
    const cellH = 28;
    const height = pad.top + pad.bottom + cellH * 12;

    svg.attr("width", width).attr("height", height);
    const g = svg.append("g").attr("transform", `translate(${pad.left},${pad.top})`);

    // Month labels
    g.selectAll("text.month").data(MONTHS).enter().append("text")
      .attr("class", "fill-gray-500 text-xs")
      .attr("x", -8).attr("y", (_, i) => i * cellH + cellH / 1.5)
      .attr("text-anchor", "end").attr("font-size", "0.75rem")
      .text((d) => d);

    // Year labels
    g.selectAll("text.year").data(years).enter().append("text")
      .attr("class", "fill-gray-500 text-xs")
      .attr("x", (_, i) => i * cellW + cellW / 2).attr("y", -8)
      .attr("text-anchor", "middle").attr("font-size", "0.75rem")
      .text((d) => d);

    // Cells
    const cellData = MONTHS.flatMap((_, row) =>
      years.map((year, col) => ({
        key: `${year}-${String(row + 1).padStart(2, "0")}`,
        year,
        month: row + 1,
        row, col,
      }))
    );

    const cells = g.append("g").selectAll("g.cell")
      .data(cellData).enter().append("g")
      .attr("transform", (d) => `translate(${d.col * cellW},${d.row * cellH})`)
      .style("cursor", "pointer");

    cells.append("rect")
      .attr("width", cellW - 4).attr("height", cellH - 6)
      .attr("rx", 4).attr("ry", 4)
      .attr("class", "calendar-cell")
      .attr("stroke", (d) => d.key === selectedCell ? "#3273dc" : "rgba(0,0,0,0.05)")
      .attr("stroke-width", (d) => d.key === selectedCell ? 2.5 : 1)
      .attr("fill", (d) => {
        const bucket = grouped.get(d.key);
        if (!bucket?.length) return "#f5f5f5";
        const total = bucket.reduce((a, c) => a + c.event_count, 0);
        return getColorScale(colorScheme)(total);
      })
      .on("click", (_, d) => {
        const bucket = grouped.get(d.key);
        const hasEvents = !!bucket?.length;
        const topEvent = hasEvents
          ? [...bucket!].sort((a, b) => b.event_count - a.event_count)[0]
          : null;
        onSelectCell({
          year: d.year,
          month: d.month,
          eventKey: topEvent?.event_key || null,
          hasEvents,
        });
      });

    cells.append("text")
      .attr("x", 4).attr("y", cellH / 2)
      .attr("font-size", "0.75rem").attr("font-weight", "600").attr("fill", "#2a2a2a")
      .attr("pointer-events", "none")
      .text((d) => {
        const bucket = grouped.get(d.key) || [];
        if (!bucket.length) return "";
        return bucket.reduce((a, c) => a + c.event_count, 0);
      });
  }, [data, grouped, startYear, endYear, selectedCell, onSelectCell, colorScheme]);

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
