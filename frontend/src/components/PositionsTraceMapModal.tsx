import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  ZoomControl,
  Polygon,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import Modal from './Modal';
import { FiMapPin, FiX } from 'react-icons/fi';
import { apiUrl } from '@/config/env';

export interface SinglePositionRow {
  id: number;
  lat: number;
  lon: number;
  timestamp: string;
  accuracy?: number | null;
  speed?: number | null;
  vehicleMode?: boolean;
  hadRuleViolationAtSave?: boolean;
  /** Mentéskor rögzített játékterület(ek) */
  gameAreaSnapshot?: unknown;
}

export interface TracePosition {
  id: number;
  lat: number;
  lon: number;
  timestamp: string;
  accuracy?: number | null;
  speed?: number | null;
  vehicleMode?: boolean;
  hadRuleViolationAtSave?: boolean;
}

export interface GeofenceMapShape {
  id: number;
  name: string;
  centerLat: number;
  centerLon: number;
  radiusM: number;
  active: boolean;
  geofenceType: string;
  metadataJson?: {
    polygon?: number[][];
    type?: string;
    countyCode?: string;
    countyName?: string;
  } | null;
}

function normalizeGameAreaSnapshot(raw: unknown): GeofenceMapShape[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: GeofenceMapShape[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const id = Number(o.id);
    const centerLat = Number(o.centerLat);
    const centerLon = Number(o.centerLon);
    const radiusM = Number(o.radiusM);
    if (!Number.isFinite(id) || !Number.isFinite(centerLat) || !Number.isFinite(centerLon) || !Number.isFinite(radiusM)) {
      continue;
    }
    out.push({
      id,
      name: typeof o.name === 'string' ? o.name : `Terület #${id}`,
      centerLat,
      centerLon,
      radiusM,
      active: o.active !== false,
      geofenceType: typeof o.geofenceType === 'string' ? o.geofenceType : 'game_area',
      metadataJson: (o.metadataJson as GeofenceMapShape['metadataJson']) ?? null,
    });
  }
  return out;
}

interface PositionsTraceMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: 'trace' | 'single';
  pairId: number;
  /** Első sor alatt: Pár #n · dátum vagy időintervallum */
  headerSubtitle: string;
  singleRow?: SinglePositionRow;
  fromIso?: string;
  toIso?: string;
}

const AREA_STROKE = '#38bdf8';
const AREA_WEIGHT = 2;

function FitTraceBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: false });
      return;
    }
    const b = L.latLngBounds(points);
    map.fitBounds(b, { padding: [48, 48], maxZoom: 16, animate: false });
  }, [map, points]);
  return null;
}

function MapInvalidateWhenOpen({ open }: { open: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!open) return;
    const delays = [0, 80, 200, 400, 650];
    const ids = delays.map((delay) =>
      window.setTimeout(() => {
        map.invalidateSize({ animate: false });
      }, delay),
    );
    return () => ids.forEach((t) => window.clearTimeout(t));
  }, [map, open]);
  return null;
}

/** Egyedi bezárás (closeButton={false}); a fő térkép popupjai változatlanok maradnak. */
function LeafletPopupClose({ className }: { className?: string }) {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => map.closePopup()}
      className={`inline-flex shrink-0 items-center justify-center p-0.5 text-gray-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-sky-400/50 ${className ?? ''}`}
      aria-label="Bezárás"
    >
      <FiX className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}

function SavedGameAreaPopupBody({
  name,
  label = 'Játékterület',
  radiusM,
}: {
  name: string;
  label?: string;
  radiusM?: number;
}) {
  return (
    <div className="ck-ga-popup-inner flex max-w-[min(92vw,256px)] min-w-[184px] flex-col px-3 pt-3 pb-0.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_10px] shadow-sky-500" />
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[10px] font-bold uppercase leading-none tracking-wider text-sky-400/90">{label}</div>
            <div className="mt-1 text-sm font-bold leading-tight text-white break-words">{name}</div>
          </div>
        </div>
        <LeafletPopupClose className="-mr-1 -mt-1 shrink-0" />
      </div>
      <div className="mt-1.5 border-t border-white/10 pt-0 pb-0">
        <p className={`m-0 text-[11.5px] leading-[1.15] text-gray-400 ${typeof radiusM === 'number' ? 'mt-1' : ''}`}>
          {typeof radiusM === 'number' && <div className="text-[11px] tabular-nums text-gray-400">Sugár: {Math.round(radiusM)} m</div>}
          {typeof radiusM === 'number' ? 'Mentéskor rögzített pillanatkép.' : 'A pozíció mentésekor érvényes határ (pillanatkép).'}
        </p>
      </div>
    </div>
  );
}

function labelForSnapshot(g: GeofenceMapShape): string {
  if (g.metadataJson?.countyCode || g.metadataJson?.countyName) {
    return g.name === 'Budapest' ? 'Főváros' : 'Vármegye';
  }
  if (g.geofenceType === 'game_area') return 'Játékterület';
  return 'Zóna';
}

function SavedGameAreaLayer({ geofences }: { geofences: GeofenceMapShape[] }) {
  // Mentéskori pillanatkép: lehet játékterület, vármegye vagy egyedi zóna is.
  // Itt NEM szűrünk geofenceType-ra, különben a custom zónák eltűnnek.
  const list = geofences;
  return (
    <>
      {list.map((g) => {
        if (g.metadataJson?.polygon && g.metadataJson.polygon.length > 0) {
          const positions = g.metadataJson.polygon.map(([lon, lat]) => [lat, lon] as [number, number]);
          return (
            <Polygon
              key={`ga-${g.id}`}
              positions={positions}
              pathOptions={{
                color: AREA_STROKE,
                fillColor: AREA_STROKE,
                fillOpacity: 0.08,
                weight: AREA_WEIGHT,
                opacity: 0.85,
              }}
            >
              <Popup className="custom-popup-dark ck-ga-popup" closeButton={false}>
                <SavedGameAreaPopupBody name={g.name} label={labelForSnapshot(g)} />
              </Popup>
            </Polygon>
          );
        }
        return (
          <Circle
            key={`ga-c-${g.id}`}
            center={[g.centerLat, g.centerLon]}
            radius={g.radiusM}
            pathOptions={{
              color: AREA_STROKE,
              fillColor: AREA_STROKE,
              fillOpacity: 0.06,
              weight: AREA_WEIGHT,
              opacity: 0.85,
            }}
          >
            <Popup className="custom-popup-dark ck-ga-popup" closeButton={false}>
              <SavedGameAreaPopupBody name={g.name} label={labelForSnapshot(g)} radiusM={g.radiusM} />
            </Popup>
          </Circle>
        );
      })}
    </>
  );
}

function PositionPopupBody({ row }: { row: TracePosition }) {
  const speedKmH = row.speed != null ? Number(row.speed) : null;
  // GPS zaj: álló helyzetben is tud 1–4 km/h-t “mérni”
  const displaySpeedKmH = speedKmH != null && speedKmH < 5 ? 0 : speedKmH;
  return (
    <div className="min-w-[220px] space-y-2 p-3 font-sans text-xs">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[11px] leading-none text-gray-500">#{row.id}</span>
          <span className="text-[10px] font-semibold uppercase leading-none text-sky-400/90">Mentett pont</span>
        </div>
        <LeafletPopupClose className="-mr-0.5" />
      </div>
      <div className="text-gray-200">{new Date(row.timestamp).toLocaleString('hu-HU')}</div>
      <div className="font-mono text-[11px] text-gray-400">
        {row.lat.toFixed(5)}, {row.lon.toFixed(5)}
      </div>
      {row.accuracy != null && (
        <div className="text-gray-500">
          Pontosság: <span className="text-gray-300">{Math.round(row.accuracy)} m</span>
        </div>
      )}
      {displaySpeedKmH != null && (
        <div className="text-gray-500">
          Sebesség: <span className="text-gray-300">{displaySpeedKmH.toFixed(1)} km/h</span>
        </div>
      )}
      {row.vehicleMode != null && (
        <div className="text-gray-500">
          Járműhasználat:{' '}
          <span className={row.vehicleMode ? 'text-emerald-400 font-semibold' : 'text-slate-300 font-semibold'}>
            {row.vehicleMode ? 'Jármű mód' : 'Gyalogos'}
          </span>
        </div>
      )}
      {typeof row.hadRuleViolationAtSave === 'boolean' && (
        <div className="text-gray-500">
          Szabályszegés:{' '}
          <span className={row.hadRuleViolationAtSave ? 'font-semibold text-red-400' : 'font-semibold text-emerald-400'}>
            {row.hadRuleViolationAtSave ? 'Aktív volt' : 'Rendben volt'}
          </span>
        </div>
      )}
    </div>
  );
}

export default function PositionsTraceMapModal({
  isOpen,
  onClose,
  variant,
  pairId,
  headerSubtitle,
  singleRow,
  fromIso,
  toIso,
}: PositionsTraceMapModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<TracePosition[]>([]);

  const savedAreas = useMemo(() => {
    if (variant !== 'single' || !singleRow) return [];
    return normalizeGameAreaSnapshot(singleRow.gameAreaSnapshot);
  }, [variant, singleRow]);

  const loadTrace = useCallback(async () => {
    if (!isOpen || !pairId || variant !== 'trace') return;
    if (fromIso && toIso && new Date(fromIso).getTime() > new Date(toIso).getTime()) {
      setError('Az „időponttól” nem lehet későbbi, mint az „időpontig”.');
      setPositions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('pairId', String(pairId));
      params.set('page', '1');
      params.set('pageSize', '5000');
      params.set('sortBy', 'timestamp');
      params.set('sortDir', 'asc');
      if (fromIso) params.set('from', fromIso);
      if (toIso) params.set('to', toIso);

      const res = await fetch(apiUrl(`/api/positions/admin/list?${params}`), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        if (res.status === 403) setError('Nincs jogosultsága ehhez a nézethez.');
        else if (res.status === 400)
          setError('Érvénytelen időszűrés. Ellenőrizze, hogy az időponttól ne legyen későbbi, mint az időpontig.');
        else setError('A pozíciók betöltése nem sikerült.');
        setPositions([]);
        return;
      }
      const data = await res.json();
      const items = (data.items || []) as TracePosition[];
      setPositions(
        items.map((r) => ({
          id: r.id,
          lat: r.lat,
          lon: r.lon,
          timestamp: r.timestamp,
          accuracy: r.accuracy,
          speed: r.speed,
          vehicleMode: r.vehicleMode,
          hadRuleViolationAtSave: r.hadRuleViolationAtSave,
        })),
      );
    } catch {
      setError('Hálózati hiba történt.');
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, pairId, fromIso, toIso, variant]);

  useEffect(() => {
    if (variant === 'single' && singleRow) {
      setLoading(false);
      setError(null);
      setPositions([
        {
          id: singleRow.id,
          lat: singleRow.lat,
          lon: singleRow.lon,
          timestamp: singleRow.timestamp,
          accuracy: singleRow.accuracy,
          speed: singleRow.speed,
          vehicleMode: singleRow.vehicleMode,
          hadRuleViolationAtSave: singleRow.hadRuleViolationAtSave,
        },
      ]);
      return;
    }
    void loadTrace();
  }, [variant, singleRow, loadTrace]);

  const latLngs = useMemo<[number, number][]>(
    () => positions.map((p) => [p.lat, p.lon]),
    [positions],
  );

  const centerDefault: [number, number] = latLngs[0] ?? [47.1625, 19.5033];

  const modalMax =
    variant === 'single'
      ? 'max-w-[min(100%,28rem)] sm:max-w-xl'
      : 'max-w-[min(100%,56rem)]';

  const mapHeightClass =
    variant === 'single' ? 'h-[min(48vh,380px)] sm:min-h-[300px]' : 'h-[min(58vh,520px)] sm:min-h-[360px]';

  const title = (
    <div className="flex items-center gap-4 min-w-0 pr-2">
      <div className="flex-shrink-0 p-2 rounded-lg flex items-center justify-center bg-blue-500/20">
        <FiMapPin className="w-5 h-5 text-blue-400" />
      </div>
      <div className="flex flex-col min-w-0 justify-center leading-tight gap-0.5">
        <span className="text-xl font-bold text-white leading-tight">
          {variant === 'single' ? 'Mentett pozíció' : 'Mentett nyomvonal'}
        </span>
        <span className="text-xs sm:text-sm font-normal normal-case tracking-normal text-gray-400 leading-snug break-words">
          {headerSubtitle}
        </span>
      </div>
    </div>
  );

  const showSavedGameArea = variant === 'single' && savedAreas.length > 0;

  const rowById = useMemo(() => {
    const m = new Map<number, TracePosition>();
    for (const p of positions) m.set(p.id, p);
    return m;
  }, [positions]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth={modalMax} variant="blue">
      <div className="p-0 max-h-[min(92vh,860px)] flex flex-col">
        {loading && variant === 'trace' && (
          <div className="px-4 sm:px-6 py-3 text-sm text-gray-400 border-b border-white/5 flex items-center gap-2 shrink-0">
            <span className="inline-block w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            Pozíciók betöltése…
          </div>
        )}
        {error && (
          <div className="mx-4 sm:mx-6 mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-red-200 text-sm font-medium shrink-0">
            {error}
          </div>
        )}
        <div className={`relative w-full ${mapHeightClass} rounded-b-2xl overflow-hidden bg-black/40 ck-positions-map-root shrink min-h-0`}>
          {!loading && !error && positions.length === 0 && (
            <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-2 text-gray-500 bg-[#121212]/90 backdrop-blur-sm">
              <FiMapPin className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">Ehhez a szűréshez nincs megjeleníthető pont.</p>
            </div>
          )}
          <MapContainer
            key={`${variant}-${pairId}-${positions.length}`}
            center={centerDefault}
            zoom={latLngs.length ? 13 : 7}
            zoomControl={false}
            className="h-full w-full z-0"
            scrollWheelZoom
            style={{ background: '#0f0f0f' }}
          >
            <MapInvalidateWhenOpen open={isOpen} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="" />
            <ZoomControl position="bottomright" />
            {showSavedGameArea && <SavedGameAreaLayer geofences={savedAreas} />}
            {latLngs.length > 1 && (
              <Polyline
                positions={latLngs}
                pathOptions={{
                  color: '#3b82f6',
                  weight: 4,
                  opacity: 0.85,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            )}
            {positions.map((p, idx) => {
              const isStart = idx === 0;
              const isEnd = idx === positions.length - 1 && positions.length > 1;
              const color = isStart ? '#22c55e' : isEnd ? '#f97316' : '#60a5fa';
              const r = isStart || isEnd ? 9 : 5;
              const row = rowById.get(p.id) ?? p;
              return (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lon]}
                  radius={r}
                  pathOptions={{
                    color: '#fff',
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.95,
                  }}
                >
                  <Popup className="custom-popup-dark" closeButton={false}>
                    <PositionPopupBody row={row} />
                  </Popup>
                </CircleMarker>
              );
            })}
            {latLngs.length > 0 && <FitTraceBounds points={latLngs} />}
          </MapContainer>
        </div>
        {positions.length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-t border-white/5 bg-black/30 space-y-1 shrink-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-500">
              {positions.length > 1 && (
                <>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500 border border-white/30" /> Kezdőpont
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500 border border-white/30" /> Utolsó pont
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-400 border border-white/30" /> Köztes pontok
                  </span>
                </>
              )}
              {positions.length === 1 && (
                <span className="text-gray-400">
                  {variant === 'single'
                    ? 'A kiválasztott mentett pozíció látható — kattintson a jelölőre a részletekért.'
                    : 'Egy pont esetén a nyomvonal nem rajzolódik, csak a jelölő.'}
                </span>
              )}
              {variant === 'trace' && positions.length > 1 && (
                <>
                  <span className="hidden sm:inline text-white/25 select-none" aria-hidden>
                    ·
                  </span>
                  <span className="text-gray-500">
                    {positions.length} pont (legfeljebb 5000 a szűrőnek megfelelően).
                  </span>
                </>
              )}
            </div>
            {variant === 'single' && !showSavedGameArea && (
              <p className="text-[11px] text-gray-600 leading-relaxed border-t border-white/5 pt-2 mt-2">
                Ehhez a mentéshez nem áll rendelkezésre játékterület-pillanatkép (régebbi adat vagy üres mentés).
              </p>
            )}
            {variant === 'single' && showSavedGameArea && (
              <p className="text-[11px] text-gray-600 leading-relaxed border-t border-white/5 pt-2 mt-2">
                A kék körvonal a pozíció <span className="text-gray-400">mentésekor</span> érvényes játékterületét mutatja.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
