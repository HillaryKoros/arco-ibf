/**
 * Static event data derived from MDX storylines.
 * Each entry represents a country-level disaster event with monthly spans.
 */
import type { CalendarEvent, Region } from "./api";

interface MDXEvent {
  country: string;
  code: string;
  emdat?: string;
  severity: string;
  center: [number, number]; // [lat, lng]
  periods: { year: number; months: number[] }[];
  affected?: string;
  deaths?: string;
  displaced?: string;
}

// ── Drought events from east-africa-drought.mdx ──
const DROUGHT_EVENTS: MDXEvent[] = [
  { country: "Burundi", code: "BDI", severity: "high", center: [-3.30, 29.92],
    periods: [{ year: 2021, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2022, months: [1,2,3,4,5,6] }],
    affected: "1.4M" },
  { country: "Djibouti", code: "DJI", severity: "severe", center: [11.57, 43.15],
    periods: [{ year: 2021, months: [6,7,8,9,10,11,12] }, { year: 2022, months: [1,2,3,4,5,6,7,8,9,10] }, { year: 2023, months: [1,2,3] }],
    affected: "194K" },
  { country: "Eritrea", code: "ERI", severity: "high", center: [15.33, 38.93],
    periods: [{ year: 2021, months: [6,7,8,9,10,11,12] }, { year: 2022, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2023, months: [1,2,3] }],
    affected: "1.6M" },
  { country: "Ethiopia", code: "ETH", emdat: "2021-9546-ETH", severity: "extreme", center: [9.02, 38.75],
    periods: [{ year: 2020, months: [10,11,12] }, { year: 2021, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2022, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2023, months: [1,2,3,4,5,6] }],
    affected: "24.1M" },
  { country: "Kenya", code: "KEN", emdat: "2021-9152-KEN", severity: "extreme", center: [-1.29, 36.82],
    periods: [{ year: 2020, months: [10,11,12] }, { year: 2021, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2022, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2023, months: [1,2,3,4,5,6] }],
    affected: "4.5M" },
  { country: "Rwanda", code: "RWA", severity: "moderate", center: [-1.94, 29.87],
    periods: [{ year: 2021, months: [6,7,8,9,10,11,12] }, { year: 2022, months: [1,2,3] }],
    affected: "250K" },
  { country: "Somalia", code: "SOM", emdat: "2021-9152-SOM", severity: "extreme", center: [2.05, 45.32],
    periods: [{ year: 2020, months: [10,11,12] }, { year: 2021, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2022, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2023, months: [1,2,3,4,5,6] }],
    affected: "8.3M", deaths: "43K", displaced: "1.4M" },
  { country: "South Sudan", code: "SSD", emdat: "2021-9639-SSD", severity: "severe", center: [6.88, 31.60],
    periods: [{ year: 2019, months: [6,7,8,9,10,11,12] }, { year: 2020, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2021, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2022, months: [1,2,3,4,5,6] }],
    affected: "7.76M", displaced: "2.2M" },
  { country: "Sudan", code: "SDN", emdat: "2022-9788-SDN", severity: "high", center: [15.50, 32.56],
    periods: [{ year: 2020, months: [6,7,8,9,10,11,12] }, { year: 2021, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2022, months: [1,2,3,4,5,6,7,8,9,10,11,12] }, { year: 2023, months: [1,2,3,4,5,6] }],
    affected: "7.74M", displaced: "3.7M" },
  { country: "Tanzania", code: "TZA", severity: "severe", center: [-6.37, 34.89],
    periods: [{ year: 2022, months: [6,7,8,9,10,11,12] }, { year: 2023, months: [1,2,3,4,5,6] }],
    affected: "2.2M" },
  { country: "Uganda", code: "UGA", emdat: "2022-9436-UGA", severity: "extreme", center: [0.35, 32.58],
    periods: [{ year: 2021, months: [6,7,8,9,10,11,12] }, { year: 2022, months: [1,2,3,4,5,6,7,8,9,10,11,12] }],
    affected: "518K", deaths: "900+" },
];

// ── Flood events from east-africa-floods.mdx ──
const FLOOD_EVENTS: MDXEvent[] = [
  { country: "Burundi", code: "BDI", emdat: "2023-0812", severity: "severe", center: [-3.37, 29.92],
    periods: [{ year: 2023, months: [10,11,12] }, { year: 2024, months: [1,2,3,4] }],
    affected: "203K+", displaced: "98K+" },
  { country: "Djibouti", code: "DJI", emdat: "2019-0642", severity: "high", center: [11.57, 43.15],
    periods: [{ year: 2019, months: [11] }],
    affected: "250K", deaths: "9" },
  { country: "Eritrea", code: "ERI", severity: "moderate", center: [15.33, 38.93],
    periods: [{ year: 2024, months: [5] }],
    affected: "5K", displaced: "2K" },
  { country: "Ethiopia", code: "ETH", emdat: "2024-0189", severity: "extreme", center: [9.02, 38.75],
    periods: [{ year: 2024, months: [4,5] }],
    affected: "590K+", displaced: "95K" },
  { country: "Kenya", code: "KEN", emdat: "2024-0156", severity: "extreme", center: [-1.29, 36.82],
    periods: [{ year: 2024, months: [3,4] }],
    affected: "165K", deaths: "188", displaced: "165K" },
  { country: "Rwanda", code: "RWA", emdat: "2023-0283", severity: "extreme", center: [-1.94, 29.87],
    periods: [{ year: 2023, months: [5] }],
    affected: "52K", deaths: "131", displaced: "20K" },
  { country: "Somalia", code: "SOM", emdat: "2023-0891", severity: "extreme", center: [2.05, 45.32],
    periods: [{ year: 2023, months: [10,11,12] }, { year: 2024, months: [1,2,3,4,5,6] }],
    affected: "2.5M", deaths: "4", displaced: "1.2M+" },
  { country: "South Sudan", code: "SSD", emdat: "2024-0512", severity: "extreme", center: [6.88, 31.60],
    periods: [{ year: 2024, months: [8,9,10] }],
    affected: "1.4M", displaced: "379K" },
  { country: "Sudan", code: "SDN", emdat: "2024-0445", severity: "severe", center: [15.50, 32.56],
    periods: [{ year: 2024, months: [6,7,8,9] }],
    affected: "50K", deaths: "5", displaced: "10K" },
  { country: "Tanzania", code: "TZA", emdat: "2023-0924", severity: "severe", center: [-6.37, 34.89],
    periods: [{ year: 2023, months: [11,12] }, { year: 2024, months: [1,2,3,4] }],
    affected: "200K", deaths: "155", displaced: "51K" },
  { country: "Uganda", code: "UGA", emdat: "2023-0744", severity: "high", center: [0.35, 32.58],
    periods: [{ year: 2023, months: [1,2,3,4,5,6,7,8,9,10,11,12] }],
    affected: "98K", displaced: "8K" },
];

function eventsToCalendar(events: MDXEvent[], hazard: string): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  events.forEach((ev) => {
    const eventKey = ev.emdat || `${hazard}-${ev.code}`;
    ev.periods.forEach(({ year, months }) => {
      months.forEach((month) => {
        result.push({
          year,
          month,
          event_count: 1,
          event_key: eventKey,
          total_deaths: 0,
          total_affected: 0,
          regions_affected: 1,
          countries_affected: 1,
          level: ev.severity === "extreme" ? 4 : ev.severity === "severe" ? 3 : ev.severity === "high" ? 2 : 1,
        });
      });
    });
  });
  return result;
}

function eventsToRegions(events: MDXEvent[], eventKey: string): Region[] {
  const ev = events.find((e) => (e.emdat || `unknown-${e.code}`) === eventKey);
  if (!ev) return [];
  return [{ shapeID: ev.code, shapeName: ev.country, shapeGroup: ev.code, frequency: 1 }];
}

export function getStaticCalendarData(hazard: string): CalendarEvent[] {
  if (hazard === "drought") return eventsToCalendar(DROUGHT_EVENTS, "drought");
  if (hazard === "flood") return eventsToCalendar(FLOOD_EVENTS, "flood");
  return [];
}

export function getStaticRegions(eventKey: string): Region[] {
  // Search both hazards
  const allEvents = [...DROUGHT_EVENTS, ...FLOOD_EVENTS];
  const ev = allEvents.find((e) => {
    const key = e.emdat || `drought-${e.code}`;
    return key === eventKey;
  }) || allEvents.find((e) => {
    const key = e.emdat || `flood-${e.code}`;
    return key === eventKey;
  });
  if (!ev) return [];
  return [{ shapeID: ev.code, shapeName: ev.country, shapeGroup: ev.code, frequency: 1 }];
}

export function getStaticEventCount(hazard: string): number {
  if (hazard === "drought") return DROUGHT_EVENTS.length;
  if (hazard === "flood") return FLOOD_EVENTS.length;
  return 0;
}

/** All regions (countries) for a given hazard — for the choropleth */
export function getAllRegionsForHazard(hazard: string): Region[] {
  const events = hazard === "drought" ? DROUGHT_EVENTS : hazard === "flood" ? FLOOD_EVENTS : [];
  return events.map((ev) => {
    const severity = ev.severity === "extreme" ? 4 : ev.severity === "severe" ? 3 : ev.severity === "high" ? 2 : 1;
    return { shapeID: ev.code, shapeName: ev.country, shapeGroup: ev.code, frequency: severity };
  });
}
