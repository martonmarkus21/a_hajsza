/**
 * Olvasásra optimalizált hibaüzenet a fetch válasz JSON-jéből (NestJS HttpException, ValidationPipe, stb.).
 */
export function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (payload == null || typeof payload !== 'object') return fallback;
  const d = payload as Record<string, unknown>;
  const m = d.message;
  if (typeof m === 'string' && m.trim()) return m.trim();
  if (Array.isArray(m) && m.length > 0) {
    const s = m.map(String).filter(Boolean).join(' ');
    return s || fallback;
  }
  if (m != null && typeof m === 'object') {
    const inner = (m as Record<string, unknown>).message;
    if (typeof inner === 'string' && inner.trim()) return inner.trim();
  }
  return fallback;
}
