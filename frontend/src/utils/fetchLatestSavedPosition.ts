import type { SinglePositionRow } from '../components/PositionsTraceMapModal';

/** Legutóbbi mentett pozíció (admin/üldöző JWT). Null, ha nincs mentés. */
export async function fetchLatestSavedPositionForPair(pairId: number): Promise<SinglePositionRow | null> {
  const res = await fetch(`http://localhost:3000/api/positions/pair/${pairId}/latest-saved`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as SinglePositionRow | null;
  if (!data || data.id == null) return null;
  return data;
}
