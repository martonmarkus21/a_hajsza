/** Great-circle distance in metres (WGS84 sphere). */
export function haversineDistanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371008.8;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

export function formatKmHu(meters: number): string {
  const km = meters / 1000;
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(km);
}
