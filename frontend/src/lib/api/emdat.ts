import type { EmdatMonthDatum, EmdatRegionDatum } from '@/types/emdat';

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  return res.json();
}

export async function fetchEmdatMonthlyRisk(
  disasterType: string,
): Promise<EmdatMonthDatum[]> {
  const payload = await request<{ data?: EmdatMonthDatum[] }>(
    `/api/emdat-monthly-risk?type=${disasterType}`,
  );
  return payload.data ?? [];
}

export async function fetchEmdatMonthRegions(
  eventKey: string,
): Promise<EmdatRegionDatum[]> {
  const payload = await request<{ regions?: EmdatRegionDatum[] }>(
    `/api/emdat-month-regions/${eventKey}`,
  );
  return payload.regions ?? [];
}

export async function fetchEmdatAllRegions(
  disasterType: string,
): Promise<EmdatRegionDatum[]> {
  const payload = await request<{ regions?: EmdatRegionDatum[] }>(
    `/api/emdat-all-regions?type=${disasterType}`,
  );
  return payload.regions ?? [];
}
