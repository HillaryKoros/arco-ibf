"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { getColorScale } from "@/lib/colors";
import type { CalendarEvent } from "@/lib/api";
import { useResizeObserver } from "@/hooks/useResizeObserver";

export interface CalendarSelection {
  year: number;
  month: number;
  eventKey: string | null;
  hasEvents: boolean;
  /** YYYY-MM for monthly, YYYY-MM-DD for daily */
  dateKey: string;
}

interface Props {
  data: CalendarEvent[];
  startYear: number;
  endYear: number;
  selectedCell: string | null;
  onSelectCell: (sel: CalendarSelection | null) => void;
  colorScheme?: "drought" | "flood";
  mode?: "monthly" | "daily";
  /** If true, cells are uniform color (no frequency-based coloring) */
  synthetic?: boolean;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const LABEL_WIDTH_MONTHLY = 42;
const LABEL_WIDTH_DAILY = 28;

export function CalendarHeatmap({
  data, startYear, endYear, selectedCell, onSelectCell, colorScheme, mode = "monthly", synthetic = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const labelSvgRef = useRef<SVGSVGElement>(null);
  const { width } = useResizeObserver(containerRef as React.RefObject<HTMLElement>, 960, 400);

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

  const groupedRef = useRef(grouped);
  groupedRef.current = grouped;

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = startYear; y <= endYear; y++) arr.push(y);
    return arr;
  }, [startYear, endYear]);

  const handleCellClick = useCallback(
    (urlKey: string, lookupKey: string) => {
      const [yearStr, monthStr] = lookupKey.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      const bucket = groupedRef.current.get(lookupKey);
      const hasEvents = !!bucket?.length;
      const topEvent = hasEvents
        ? [...bucket!].sort((a, b) => b.event_count - a.event_count)[0]
        : null;
      onSelectCell({
        year, month,
        eventKey: topEvent?.event_key || null,
        hasEvents,
        dateKey: urlKey,
      });
    },
    [onSelectCell],
  );

  // ── MONTHLY CALENDAR ──
  useEffect(() => {
    if (!svgRef.current || !labelSvgRef.current || mode !== "monthly" || years.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const labelSvg = d3.select(labelSvgRef.current);
    labelSvg.selectAll("*").remove();

    const colorFn = getColorScale(colorScheme);
    const pad = { top: 32, right: 8, bottom: 8 };
    const cellW = 36;
    const cellH = 28;
    const svgWidth = pad.right + years.length * cellW;
    const svgHeight = pad.top + pad.bottom + 12 * cellH;

    svg.attr("width", svgWidth).attr("height", svgHeight);
    const g = svg.append("g").attr("transform", `translate(0,${pad.top})`);

    // Fixed month labels
    labelSvg.attr("width", LABEL_WIDTH_MONTHLY).attr("height", svgHeight);
    const lg = labelSvg.append("g").attr("transform", `translate(${LABEL_WIDTH_MONTHLY},${pad.top})`);
    lg.selectAll("text.month").data(MONTHS).enter().append("text")
      .attr("class", "fill-gray-500")
      .attr("x", -4).attr("y", (_, i) => i * cellH + cellH / 1.5)
      .attr("text-anchor", "end").attr("font-size", "0.7rem").text((d) => d);

    // Year labels in scrollable area
    g.selectAll("text.year").data(years).enter().append("text")
      .attr("class", "fill-gray-500")
      .attr("x", (_, i) => i * cellW + cellW / 2).attr("y", -8)
      .attr("text-anchor", "middle").attr("font-size", "0.7rem")
      .text((d) => d);

    // Cells
    const cellData = MONTHS.flatMap((_, row) =>
      years.map((year, col) => ({
        key: `${year}-${String(row + 1).padStart(2, "0")}`,
        row, col,
      }))
    );

    const cells = g.append("g").selectAll("g.cell")
      .data(cellData).enter().append("g")
      .attr("transform", (d) => `translate(${d.col * cellW},${d.row * cellH})`)
      .style("cursor", "pointer")
      .on("click", (_, d) => handleCellClick(d.key, d.key));

    cells.append("rect")
      .attr("width", cellW - 3).attr("height", cellH - 4)
      .attr("rx", 3).attr("ry", 3)
      .attr("class", "calendar-cell")
      .attr("data-key", (d) => d.key)
      .attr("fill", (d) => {
        const bucket = grouped.get(d.key);
        if (!bucket?.length) return synthetic ? "#e8e8e8" : "#f5f5f5";
        if (synthetic) return "#d0d7de";
        const peak = bucket.reduce((a, c) => Math.max(a, c.event_count), 0);
        return colorFn(peak);
      });

    cells.append("title").text((d) => {
      const bucket = grouped.get(d.key) ?? [];
      if (synthetic) return d.key;
      if (!bucket.length) return `${d.key}: No events`;
      return `${d.key}: ${bucket.reduce((a, c) => a + c.event_count, 0)} events`;
    });

    if (!synthetic) {
      cells.append("text")
        .attr("x", 3).attr("y", cellH / 2)
        .attr("font-size", "0.7rem").attr("font-weight", "600").attr("fill", "#2a2a2a")
        .attr("pointer-events", "none")
        .text((d) => {
          const bucket = grouped.get(d.key) || [];
          if (!bucket.length) return "";
          return bucket.reduce((a, c) => a + c.event_count, 0);
        });
    }

    // Auto-scroll to end or selected month
    if (scrollRef.current && svgWidth > width) {
      let scrollTarget = svgWidth - width;
      if (selectedCell) {
        const year = parseInt(selectedCell.split("-")[0], 10);
        const colIdx = years.indexOf(year);
        if (colIdx >= 0) scrollTarget = Math.max(0, colIdx * cellW - width / 2);
      }
      scrollRef.current.scrollLeft = scrollTarget;
    }
  }, [data, grouped, width, startYear, endYear, selectedCell, handleCellClick, colorScheme, mode, years, synthetic]);

  // ── DAILY CALENDAR (day-of-month rows × month columns) ──
  useEffect(() => {
    if (!svgRef.current || !labelSvgRef.current || mode !== "daily" || years.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const labelSvg = d3.select(labelSvgRef.current);
    labelSvg.selectAll("*").remove();

    const pad = { top: 40, right: 8, bottom: 8 };
    const cellSize = 16;
    const gap = 1;

    const columns: { year: number; month: number; key: string }[] = [];
    for (let y = startYear; y <= endYear; y++) {
      for (let m = 1; m <= 12; m++) {
        columns.push({ year: y, month: m, key: `${y}-${String(m).padStart(2, "0")}` });
      }
    }

    const colWidth = cellSize + gap;
    const rowHeight = cellSize + gap;
    const svgWidth = pad.right + columns.length * colWidth;
    const svgHeight = pad.top + pad.bottom + 31 * rowHeight;

    svg.attr("width", svgWidth).attr("height", svgHeight);
    const g = svg.append("g").attr("transform", `translate(0,${pad.top})`);

    // Fixed day-of-month labels
    labelSvg.attr("width", LABEL_WIDTH_DAILY).attr("height", svgHeight);
    const lg = labelSvg.append("g").attr("transform", `translate(${LABEL_WIDTH_DAILY},${pad.top})`);
    for (let d = 1; d <= 31; d++) {
      if (d % 5 === 1 || d === 31) {
        lg.append("text").attr("class", "fill-gray-500")
          .attr("x", -4).attr("y", (d - 1) * rowHeight + cellSize / 1.5)
          .attr("text-anchor", "end").attr("font-size", "0.55rem").text(d);
      }
    }

    // Column labels (month abbreviation, year on January)
    columns.forEach((col, ci) => {
      const isJan = col.month === 1;
      g.append("text").attr("class", "fill-gray-500")
        .attr("x", ci * colWidth + cellSize / 2)
        .attr("y", isJan ? -18 : -6)
        .attr("text-anchor", "middle")
        .attr("font-size", isJan ? "0.65rem" : "0.5rem")
        .attr("font-weight", isJan ? "700" : "400")
        .text(isJan ? col.year.toString() : MONTHS[col.month - 1].charAt(0));
    });

    // Day cells
    const dayCells: { col: number; day: number; key: string; valid: boolean }[] = [];
    columns.forEach((col, ci) => {
      const daysInMonth = new Date(col.year, col.month, 0).getDate();
      for (let d = 1; d <= 31; d++) {
        dayCells.push({ col: ci, day: d, key: col.key, valid: d <= daysInMonth });
      }
    });

    g.append("g").selectAll("rect.day").data(dayCells).enter().append("rect")
      .attr("class", "calendar-cell")
      .attr("data-key", (d) => d.key)
      .attr("width", cellSize).attr("height", cellSize)
      .attr("rx", 2).attr("ry", 2)
      .attr("x", (d) => d.col * colWidth)
      .attr("y", (d) => (d.day - 1) * rowHeight)
      .attr("fill", (d) => d.valid ? "#d0d7de" : "#fafafa")
      .attr("opacity", (d) => d.valid ? 1 : 0.3)
      .style("cursor", (d) => d.valid ? "pointer" : "default")
      .on("click", (_, d) => {
        if (d.valid) {
          const dateKey = `${d.key}-${String(d.day).padStart(2, "0")}`;
          handleCellClick(dateKey, d.key);
        }
      })
      .append("title").text((d) => {
        if (!d.valid) return "";
        return `${d.key}-${String(d.day).padStart(2, "0")}`;
      });

    // Year separator lines
    columns.forEach((col, ci) => {
      if (col.month === 1 && ci > 0) {
        const x = ci * colWidth - 0.5;
        g.append("line").attr("x1", x).attr("x2", x)
          .attr("y1", -2).attr("y2", 31 * rowHeight)
          .attr("stroke", "rgba(0,0,0,0.15)").attr("stroke-width", 1);
      }
    });

    // Auto-scroll
    if (scrollRef.current && svgWidth > width) {
      let scrollTarget = svgWidth - width;
      if (selectedCell) {
        const monthKey = selectedCell.slice(0, 7);
        const colIdx = columns.findIndex((c) => c.key === monthKey);
        if (colIdx >= 0) scrollTarget = Math.max(0, colIdx * colWidth - width / 2);
      }
      scrollRef.current.scrollLeft = scrollTarget;
    }
  }, [data, grouped, width, startYear, endYear, selectedCell, handleCellClick, colorScheme, mode, years]);

  // Highlight active cell
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll(".calendar-cell")
      .attr("stroke", "rgba(0,0,0,0.05)").attr("stroke-width", 0.5);

    if (selectedCell) {
      const monthKey = selectedCell.slice(0, 7);
      svg.selectAll(".calendar-cell")
        .filter(function () { return d3.select(this).attr("data-key") === monthKey; })
        .attr("stroke", "#3273dc").attr("stroke-width", 2);
    }
  }, [selectedCell, grouped]);

  return (
    <div ref={containerRef} className="w-full">
      <div className="flex">
        <svg ref={labelSvgRef} className="flex-shrink-0" />
        <div ref={scrollRef} className="overflow-x-auto flex-1">
          <svg ref={svgRef} />
        </div>
      </div>
    </div>
  );
}
