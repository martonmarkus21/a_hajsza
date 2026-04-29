/**
 * Backend HTTP cím (nincs záró /). A `.env` fájlban: VITE_API_URL=http://localhost:3000
 */
function normalizeApiOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

const DEFAULT_ORIGIN = 'http://localhost:3000';

export const API_ORIGIN = normalizeApiOrigin(
  (import.meta.env.VITE_API_URL as string | undefined) || DEFAULT_ORIGIN,
);

/** Teljes URL REST híváshoz (a path `/api/...` alakú legyen). */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${p}`;
}

/** A játékhoz használt WebSocket (Socket.IO) címe. */
export const WS_GAME_URL = `${API_ORIGIN}/ws/game`;
