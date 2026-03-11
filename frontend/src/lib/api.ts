/**
 * API client for Wagtail CMS + proxy endpoints.
 * In dev, Next.js rewrites /api/* → Django backend.
 */

const API_BASE = "/api";

export async function fetchCalendarData(hazard: string) {
  const res = await fetch(`${API_BASE}/proxy/emdat/emdat-monthly-risk?type=${hazard}`);
  const json = await res.json();
  return json.data || [];
}

export async function fetchRegions(eventKey: string) {
  const res = await fetch(`${API_BASE}/proxy/emdat/emdat-month-regions/${eventKey}`);
  const json = await res.json();
  return json.regions || [];
}

export async function fetchStorylineMarkdown(eventKey: string) {
  const res = await fetch(`${API_BASE}/proxy/emdat/emdat-event-markdown/${eventKey}`);
  const json = await res.json();
  return json.markdown || null;
}

export async function fetchWagtailStoryline(eventKey: string) {
  const res = await fetch(`${API_BASE}/v2/storylines/?event_key=${eventKey}&format=json`);
  const json = await res.json();
  return json.items?.[0]?.body || null;
}

export async function fetchWagtailPage(slug: string) {
  const res = await fetch(`${API_BASE}/v2/pages/?slug=${slug}&format=json`);
  const json = await res.json();
  return json.items?.[0] || null;
}

export interface CalendarEvent {
  year: number;
  month: number;
  event_count: number;
  event_key: string;
  total_deaths: number;
  total_affected: number;
  regions_affected: number;
  countries_affected: number;
  level: number;
}

export interface Region {
  shapeID: string;
  shapeName: string;
  shapeGroup: string;
  frequency: number;
}
