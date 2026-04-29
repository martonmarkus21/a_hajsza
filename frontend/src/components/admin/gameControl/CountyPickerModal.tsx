import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiGlobe, FiMap, FiMapPin, FiTarget, FiX } from 'react-icons/fi';
import { createPortal } from 'react-dom';
import MwTableSearchInput from '../../MwTableSearchInput';
import MwSwitch from '../MwSwitch';

export interface CountyPickerOption {
  code: string;
  name: string;
  polygon?: number[][];
}

export type CustomZoneOption = {
  id: string;
  name: string;
};

interface CountyPickerModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  counties: CountyPickerOption[];
  customZoneOptions: CustomZoneOption[];
  initialCounties: string[];
  initialRegionIds: string[];
  onClose: () => void;
  onSave: (counties: string[], regionIds: string[]) => void;
}

const HU_CODE = 'magyarorszag';

function normCountyCode(code: string): string {
  return deAccent(code).replace(/\s+/g, '');
}

function isBudapestEntry(c: CountyPickerOption): boolean {
  const code = normCountyCode(c.code);
  const name = deAccent(c.name);
  return code === 'budapest' || name === 'budapest';
}

function isPestEntry(c: CountyPickerOption): boolean {
  const code = normCountyCode(c.code);
  const name = deAccent(c.name);
  return code === 'pest' || name === 'pest';
}

function isNationalHungary(c: CountyPickerOption) {
  const code = c.code.toLowerCase().replace(/\s/g, '');
  const n = c.name.toLowerCase().trim();
  return code === 'magyarorszag' || n === 'magyarország';
}

function deAccent(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function CountyShapePreview({
  polygon,
  active,
  className = 'h-6 w-6',
  iconClassName = 'h-4 w-4',
}: {
  polygon?: number[][];
  active?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  const on = active ?? true;
  if (!polygon || polygon.length === 0) {
    return <FiMap className={iconClassName} />;
  }
  const lats = polygon.map((p) => p[1]);
  const lons = polygon.map((p) => p[0]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const meanLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos(meanLat * (Math.PI / 180));
  const scaledLons = lons.map((lon) => lon * cosLat);
  const minX = Math.min(...scaledLons);
  const maxX = Math.max(...scaledLons);
  const width = maxX - minX;
  const height = maxLat - minLat;
  const padX = width * 0.04;
  const padY = height * 0.04;
  const viewBox = `${minX - padX} ${-(maxLat + padY)} ${width + padX * 2} ${height + padY * 2}`;
  const pathData =
    polygon
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point[0] * cosLat} ${-point[1]}`)
      .join(' ') + ' Z';
  return (
    <svg
      viewBox={viewBox}
      className={`${className} transition-all`.trim()}
      fill={on ? 'currentColor' : 'rgba(255,255,255,0.12)'}
      stroke={on ? 'rgba(255,255,255,0.85)' : 'currentColor'}
      strokeWidth={((width + height) / 2) * 0.05}
      strokeLinejoin="round"
    >
      <path d={pathData} />
    </svg>
  );
}

export default function CountyPickerModal({
  isOpen,
  title = 'Játéktér kiválasztása',
  subtitle = 'Válassza ki az adott időponthoz tartozó aktív játékterületet a listából.',
  counties,
  customZoneOptions,
  initialCounties,
  initialRegionIds,
  onClose,
  onSave,
}: CountyPickerModalProps) {
  const [exiting, setExiting] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'counties' | 'custom'>('counties');
  const [selectedCounties, setSelectedCounties] = useState<Set<string>>(
    () => new Set(initialCounties.map(normCountyCode)),
  );
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(
    () => new Set(initialRegionIds),
  );

  const initKey = `${initialCounties.join(',')}|${initialRegionIds.join(',')}`;

  const requestClose = useCallback(() => {
    if (!isOpen || exiting) return;
    setExiting(true);
    window.setTimeout(() => {
      setExiting(false);
      onClose();
    }, 200);
  }, [isOpen, exiting, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (exiting) return;
    setSelectedCounties(new Set(initialCounties.map(normCountyCode)));
    setSelectedRegions(new Set(initialRegionIds));
    setSearch('');
    setActiveTab('counties');
  }, [isOpen, exiting, initKey, initialCounties, initialRegionIds]);

  useEffect(() => {
    if (!isOpen || exiting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, exiting, requestClose]);

  const { countyList, hungaryEntry } = useMemo(() => {
    const nat = counties.find((c) => isNationalHungary(c));
    const list = counties.filter((c) => !isNationalHungary(c));
    return { countyList: list, hungaryEntry: nat };
  }, [counties]);
  const { budapestCode, pestCode } = useMemo(() => {
    const b = countyList.find((c) => isBudapestEntry(c));
    const p = countyList.find((c) => isPestEntry(c));
    return {
      budapestCode: b ? normCountyCode(b.code) : null,
      pestCode: p ? normCountyCode(p.code) : null,
    };
  }, [countyList]);

  const hungaryPolygon = hungaryEntry?.polygon;
  const hungarySelected = selectedCounties.has(HU_CODE);

  const filteredCounties = useMemo(() => {
    const q = deAccent(search.trim());
    const base = q
      ? countyList.filter(
          (c) => deAccent(c.name).includes(q) || deAccent(c.code).includes(q),
        )
      : countyList;
    return [...base].sort((a, b) => {
      const aSel = selectedCounties.has(normCountyCode(a.code));
      const bSel = selectedCounties.has(normCountyCode(b.code));
      if (aSel !== bSel) return aSel ? -1 : 1;
      return a.name.localeCompare(b.name, 'hu');
    });
  }, [countyList, search, selectedCounties]);

  const filteredZones = useMemo(() => {
    const q = deAccent(search.trim());
    const base = q
      ? customZoneOptions.filter((z) => deAccent(z.name).includes(q) || deAccent(z.id).includes(q))
      : customZoneOptions;
    return [...base].sort((a, b) => {
      const aSel = selectedRegions.has(a.id);
      const bSel = selectedRegions.has(b.id);
      if (aSel !== bSel) return aSel ? -1 : 1;
      return a.name.localeCompare(b.name, 'hu');
    });
  }, [customZoneOptions, search, selectedRegions]);

  const toggleCounty = (code: string) => {
    const normalized = normCountyCode(code);
    setSelectedCounties((cur) => {
      const next = new Set(cur);
      if (next.has(normalized)) next.delete(normalized);
      else {
        next.add(normalized);
        if (normalized !== HU_CODE) next.delete(HU_CODE);
        if (budapestCode && pestCode) {
          if (normalized === budapestCode) next.delete(pestCode);
          if (normalized === pestCode) next.delete(budapestCode);
        }
      }
      return next;
    });
  };

  const onHungarySwitch = (on: boolean) => {
    if (on) {
      setSelectedCounties(new Set([HU_CODE]));
      setSelectedRegions(new Set());
    } else {
      setSelectedCounties((cur) => {
        const next = new Set(cur);
        next.delete(HU_CODE);
        return next;
      });
    }
  };

  const toggleRegion = (id: string) => {
    setSelectedCounties((cur) => {
      if (!cur.has(HU_CODE)) return cur;
      const next = new Set(cur);
      next.delete(HU_CODE);
      return next;
    });
    setSelectedRegions((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const m = selectedCounties.size;
  const r = selectedRegions.size;
  const selectionCount = m + r;

  const headerSummary = useMemo(() => {
    const bits = [`${selectionCount} kiválasztva`, `${countyList.length} vármegye`];
    if (customZoneOptions.length > 0) bits.push(`${customZoneOptions.length} zóna`);
    return bits.join(' · ');
  }, [m, r, countyList.length, customZoneOptions.length]);

  const placeholder =
    activeTab === 'counties' ? 'Vármegye keresése…' : 'Zóna keresése…';

  const emptyBody =
    activeTab === 'counties'
      ? filteredCounties.length === 0
      : filteredZones.length === 0;

  const closeAnim = exiting;
  const show = isOpen || exiting;

  if (!show) return null;

  const footerText = (() => {
    const bits: string[] = [];
    if (hungarySelected) bits.push('Magyarország');
    else if (m > 0) bits.push(`${m} vármegye`);
    if (r > 0) bits.push(`${r} zóna`);
    return bits.length
      ? `Kiválasztva: ${bits.join(' és ')}`
      : 'Még nincs kijelölt játékterület.';
  })();

  const doSave = () => {
    onSave(Array.from(selectedCounties), Array.from(selectedRegions));
    requestClose();
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[10050] flex items-center justify-center p-4 ${closeAnim ? 'pointer-events-none' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="county-picker-title"
    >
      <div
        className={`fixed inset-0 bg-black/75 backdrop-blur-md ${
          closeAnim ? 'animate-fade-out' : 'animate-fade-in'
        }`}
        onClick={requestClose}
        aria-hidden
      />

      <div
        className={`relative z-10 flex max-h-[min(88vh,720px)] w-full max-w-[440px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#121212]/92 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl will-change-transform ${
          closeAnim ? 'animate-scale-out' : 'animate-scale-in'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" />

        <div className="relative z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
              <FiMap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 id="county-picker-title" className="truncate text-lg font-bold text-white">
                {title}
              </h3>
              <p className="mt-0 truncate text-[11px] font-medium text-gray-500">{headerSummary}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-full p-2 text-gray-400 transition-all hover:bg-white/10 hover:text-white"
            aria-label="Bezárás"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="relative z-10 space-y-3 border-b border-white/10 px-5 py-4">
          <p className="text-xs text-gray-500">{subtitle}</p>
          <MwTableSearchInput
            value={search}
            onChange={setSearch}
            placeholder={placeholder}
            className="w-full"
            inputClassName="py-2.5 w-full"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('counties')}
              className={`mw-btn flex-1 items-center justify-center gap-2 text-sm ${
                activeTab === 'counties' ? 'mw-btn-primary' : 'mw-btn-secondary'
              }`}
            >
              <FiMap className="h-4 w-4" />
              Vármegyék
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`mw-btn flex-1 items-center justify-center gap-2 text-sm ${
                activeTab === 'custom' ? 'mw-btn-primary' : 'mw-btn-secondary'
              }`}
            >
              <FiTarget className="h-4 w-4" />
              Egyéni zónák
            </button>
          </div>
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
          <div className={activeTab === 'counties' ? '' : 'hidden'} aria-hidden={activeTab !== 'counties'}>
              <div
                className={`group relative mb-3 w-full overflow-hidden rounded-2xl p-[1px] transition-all duration-300 transform-gpu ${
                  hungarySelected
                    ? 'border border-white/10'
                    : 'border border-white/5 bg-[#2a2a2a] hover:border-white/10'
                }`}
              >
                  {hungarySelected && (
                    <div className="pointer-events-none absolute inset-0 w-full overflow-hidden">
                      <div className="absolute top-[-50%] left-[-50%] z-0 h-[200%] w-[200%] bg-[#2a2a2a]" />
                      <div className="absolute -left-10 -top-10 h-64 w-64 rounded-full bg-red-600/70 blur-[60px] filter animate-slow-flow-contained" />
                      <div className="animation-delay-2000 absolute -right-10 -top-10 h-64 w-64 rounded-full bg-green-600/70 blur-[60px] filter animate-slow-flow-contained-reverse" />
                      <div className="animation-delay-4000 absolute -bottom-20 left-[20%] h-64 w-64 rounded-full bg-white/20 blur-[60px] filter animate-drift" />
                    </div>
                  )}

                  <div
                    className={`relative z-10 flex h-full w-full items-center justify-between rounded-2xl p-3 ${
                      hungarySelected ? 'bg-transparent' : ''
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          hungarySelected
                            ? 'bg-white/10 text-white shadow-lg'
                            : 'bg-white/5 text-gray-400 group-hover:text-white'
                        }`}
                      >
                        {hungaryPolygon ? (
                          <CountyShapePreview
                            polygon={hungaryPolygon}
                            active={hungarySelected}
                            className="h-7 w-7 drop-shadow-md"
                          />
                        ) : (
                          <FiGlobe className="h-7 w-7 drop-shadow-md" />
                        )}
                      </div>
                      <div className="min-w-0 drop-shadow-md">
                        <div className="mb-0.5 text-[15px] font-semibold leading-tight text-white">Magyarország</div>
                        <div
                          className={`text-[11px] font-bold uppercase tracking-wider ${
                            hungarySelected ? 'text-gray-100' : 'text-gray-500'
                          }`}
                        >
                          {hungarySelected ? 'Aktív játékterület' : 'Teljes nézet'}
                        </div>
                      </div>
                    </div>
                    <MwSwitch
                      checked={hungarySelected}
                      onChange={onHungarySwitch}
                      srLabel="Magyarország kapcsoló"
                    />
                  </div>
              </div>

              <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-gray-500">
                <span className="uppercase tracking-wider">Vármegyék listája</span>
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
                  {filteredCounties.length}
                </span>
              </div>

              {emptyBody ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                  <FiMapPin className="h-8 w-8 text-gray-700" />
                  <p className="text-sm font-semibold text-gray-400">Nincs találat</p>
                  <p className="max-w-xs text-xs text-gray-600">Másik keresőszó, vagy üres mező.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredCounties.map((county) => {
                    const on = selectedCounties.has(normCountyCode(county.code));
                    return (
                      <button
                        key={county.code}
                        type="button"
                        onClick={() => toggleCounty(county.code)}
                        aria-pressed={on}
                        className={`group flex w-full items-center justify-between rounded-2xl border p-3 text-left transition-all duration-200 ${
                          on
                            ? 'border-orange-500/25 bg-orange-500/10'
                            : 'border-transparent hover:border-white/5 hover:bg-white/5'
                        }`}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-3">
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                              on
                                ? 'bg-orange-500 text-white'
                                : 'bg-white/5 text-gray-500 group-hover:text-gray-300'
                            }`}
                          >
                            <CountyShapePreview polygon={county.polygon} active={on} className="h-6 w-6" />
                          </span>
                          <span className="min-w-0">
                            <span
                              className={`block truncate text-[15px] font-semibold leading-tight ${
                                on ? 'text-white' : 'text-gray-300 group-hover:text-white'
                              }`}
                            >
                              {county.name}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
                              {county.name === 'Budapest' ? 'Főváros' : 'Vármegye'}
                            </span>
                          </span>
                        </span>
                        <MwSwitch
                          checked={on}
                          onChange={() => toggleCounty(county.code)}
                          srLabel={county.name}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
          </div>
          <div className={activeTab === 'custom' ? '' : 'hidden'} aria-hidden={activeTab !== 'custom'}>
            {customZoneOptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <FiTarget className="h-8 w-8 text-gray-700 opacity-30" />
              <p className="text-sm font-semibold text-gray-400">Nincs egyéni zóna</p>
              <p className="max-w-sm text-xs text-gray-600">A Térkép &amp; zónák oldalon hozhat létre.</p>
            </div>
            ) : emptyBody ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <FiMapPin className="h-8 w-8 text-gray-700" />
              <p className="text-sm font-semibold text-gray-400">Nincs találat</p>
              <p className="max-w-xs text-xs text-gray-600">Másik keresőszó, vagy üres mező.</p>
            </div>
            ) : (
            <>
              <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-gray-500">
                <span className="uppercase tracking-wider">Egyéni zónák</span>
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
                  {filteredZones.length}
                </span>
              </div>
              <div className="space-y-1">
                {filteredZones.map((z) => {
                  const on = selectedRegions.has(z.id);
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => toggleRegion(z.id)}
                      aria-pressed={on}
                      className={`group flex w-full items-center justify-between rounded-2xl border p-3 text-left transition-all duration-200 ${
                        on
                          ? 'border-emerald-500/25 bg-emerald-500/10'
                          : 'border-transparent hover:border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                            on
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white/5 text-gray-500 group-hover:text-gray-300'
                          }`}
                        >
                          <FiTarget className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span
                            className={`block truncate text-[15px] font-semibold leading-tight ${
                              on ? 'text-white' : 'text-gray-300 group-hover:text-white'
                            }`}
                          >
                            {z.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
                            Egyéni zóna
                          </span>
                        </span>
                      </span>
                      <MwSwitch checked={on} onChange={() => toggleRegion(z.id)} srLabel={z.name} />
                    </button>
                  );
                })}
              </div>
            </>
            )}
          </div>
        </div>

        <div className="relative z-10 flex min-h-[56px] items-center justify-between gap-3 border-t border-white/10 bg-black/30 px-5 py-4">
          <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{footerText}</span>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={requestClose} className="mw-btn mw-btn-secondary text-sm">
              Mégsem
            </button>
            <button type="button" onClick={doSave} className="mw-btn mw-btn-primary text-sm">
              Mentés
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
