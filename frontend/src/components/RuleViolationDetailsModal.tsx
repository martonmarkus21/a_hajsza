import { useEffect, useRef, useState } from 'react';
import { FiAlertTriangle, FiMapPin, FiClock, FiActivity, FiCheckCircle } from 'react-icons/fi';
import Modal from './Modal';
import { formatDateTimeBudapest } from '../utils/formatDateTimeBudapest';
import { apiUrl } from '@/config/env';

/** A backend `rule_violations.violation_type` értékeivel egyezik (`RuleViolationsService`). */
const TYPE_LABELS: Record<string, string> = {
  game_area_exit: 'Játékterület elhagyása',
  vehicle_time_exceeded: 'Járműhasználati idő túllépése',
  end_of_day_stay: 'Maradási szabály (játéknapok között)',
};

function archiveModalVariant(violationType: string, resolved: boolean): 'red' | 'green' | 'orange' {
  if (violationType === 'game_area_exit') return resolved ? 'green' : 'red';
  return resolved ? 'green' : 'orange';
}

function archiveExplanationPrimary(
  violationType: string,
  resolved: boolean,
  pairLabel: string,
): string | null {
  if (violationType === 'game_area_exit') {
    return resolved
      ? `A(z) ${pairLabel} ezen a bejegyzés szerint már visszatért a játékterületre — a szabályszegés lezárult. (A párnak jelenleg lehet másik, aktív figyelmeztetése is a térképen; ez a nézet mindig ehhez a naplósorhoz tartozik.)`
      : `A(z) ${pairLabel} ezen bejegyzés szerint elhagyta az aktív játékterületet. A lent látható időpontok ehhez a konkrét naplósorhoz tartoznak — nem az esetleges jelenlegi, élő figyelmeztetéshez.`;
  }
  if (violationType === 'vehicle_time_exceeded') {
    return resolved
      ? `A(z) ${pairLabel} járműhasználati szabályszegéséhez tartozó folyamatos térképes követési időablak lejárt, vagy a bejegyzés egyéb okból lezárult. A páros pozíciója ismét a szokásos lokációfrissítési szabályok szerint jelenhet meg — hacsak nincs másik, aktív szabályszegés (például játékterület elhagyása).`
      : `A(z) ${pairLabel} túllépte az épp futó járműhasználati szakasz legfeljebb 40 perces idejét (minden jármű bekapcsolásakor a számláló elölről indul; egy napon több ilyen szakasz és több külön naplóbejegyzés is lehet). Ilyenkor az üldözők ugyanúgy folyamatos, valós idejű pozíciófrissítést látnak a térképen, mint játékterület elhagyásakor. A rendszer legfeljebb kb. 15 perc után automatikusan lezárja ezt a „folyamatos követéses” ablakot, ha addig nem történik más változás.`;
  }
  if (violationType === 'end_of_day_stay') {
    return resolved
      ? `A(z) ${pairLabel} ezen maradási szabályszegés bejegyzése lezárult — például visszatértek a megengedett maradási körön belülre, vagy időzített, rendszeres lezárás történt. A térképreveláció (ha volt) továbbra is a játékszabályok és az ütemezés szerint érvényes lehet.`
      : `A(z) ${pairLabel} a játéknapok közötti maradási szabályt sértette: a megengedett körön kívül tartózkodás folyamatos, legalább 30 perces túllépése. Erre súlyosításként a következő játéknap elején korlátozott ideig az üldözők folyamatosan láthatják a mozgásukat a térképen (amennyiben ez a funkció éppen aktív).`;
  }
  return null;
}

function emphasisPairInLead(full: string, pairLabel: string) {
  const i = full.indexOf(pairLabel);
  if (i < 0) {
    return full;
  }
  return (
    <>
      {full.slice(0, i)}
      <span className="text-white">{pairLabel}</span>
      {full.slice(i + pairLabel.length)}
    </>
  );
}

/** Élő térkép / pár részletek: csak olyan típusok, amelyek az `active-game-area` API-ban szerepelhetnek. */
function liveTitleSubtitle(violationType: string, active: boolean): string {
  if (!active) return 'A szabályszegés-jelzés megszűnt';
  if (violationType === 'game_area_exit') return 'Aktív játékterület elhagyása';
  if (violationType === 'vehicle_time_exceeded') return `Aktív: ${TYPE_LABELS.vehicle_time_exceeded}`;
  return `Aktív: ${TYPE_LABELS[violationType] || violationType}`;
}

function liveCalloutPrimary(violationType: string, active: boolean, pairLabel: string): string {
  if (active) {
    if (violationType === 'vehicle_time_exceeded') {
      return `A(z) ${pairLabel} túllépte a járműhasználati időkeretet. Az üldözők folyamatos, valós idejű pozíciófrissítést látnak a térképen (a szokásos lokációszámlálótól függetlenül). A rendszer legfeljebb kb. 15 perc után automatikusan lezárja ezt az ablakot.`;
    }
    if (violationType === 'game_area_exit') {
      return `A(z) ${pairLabel} elhagyta az aktív játékterületet. A szabály szerint Ön és a többi üldöző folyamatos, valós idejű pozíciófrissítést lát erről a párról a térképen, a szokásos lokációfrissítési számlálótól függetlenül.`;
    }
    return `A(z) ${pairLabel} aktív szabályszegés alatt áll (${TYPE_LABELS[violationType] || violationType}).`;
  }
  if (violationType === 'vehicle_time_exceeded') {
    return `A(z) ${pairLabel} járműhasználati, folyamatos követéses jelzése lejárt a térképen. A pozíció megjelenítése ismét a szokásos szabályok szerint történik — kivéve, ha más szabályszegés is aktív ennél a párnál.`;
  }
  if (violationType === 'game_area_exit') {
    return `A(z) ${pairLabel} visszatért az aktív játékterületre. A szabályszegés megszűnt: a páros pozíciója ismét a normál lokációfrissítési szabályok szerint jelenik meg a térképen.`;
  }
  return `A(z) ${pairLabel} szabályszegés-jelzése megszűnt a térképen.`;
}

export interface RuleViolationArchiveSnapshot {
  violationId: number;
  violationType: string;
  description: string | null;
  createdAt: string | null;
  resolved: boolean;
  resolvedAt: string | null;
}

interface RuleViolationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pairId: number | null;
  initialAssignedNumber?: number | null;
  initialPairName?: string | null;
  initialStartedAt?: string | null;
  /** Élő nézet: `active-game-area` válaszból / socketből — a szöveg ehhez igazodik (játékterület vs. jármű). */
  initialLiveViolationType?: string | null;
  /** Admin napló: adott sor pillanatképe — nem írjuk felül az élő API-val */
  archiveSnapshot?: RuleViolationArchiveSnapshot | null;
}

export default function RuleViolationDetailsModal({
  isOpen,
  onClose,
  pairId,
  initialAssignedNumber,
  initialPairName,
  initialStartedAt,
  initialLiveViolationType,
  archiveSnapshot,
}: RuleViolationDetailsModalProps) {
  const isArchive = archiveSnapshot != null;

  const [liveActive, setLiveActive] = useState(true);
  const [liveViolationType, setLiveViolationType] = useState<string>('game_area_exit');
  const [assignedNumber, setAssignedNumber] = useState<number | null>(initialAssignedNumber ?? null);
  const [pairName, setPairName] = useState<string | null>(initialPairName ?? null);
  const [displayStartedAt, setDisplayStartedAt] = useState<string | null>(initialStartedAt ?? null);
  const lastStartedAtRef = useRef<string | null>(initialStartedAt ?? null);

  useEffect(() => {
    if (!isOpen || pairId == null) return;
    setAssignedNumber(initialAssignedNumber ?? null);
    setPairName(initialPairName ?? null);
    const start = initialStartedAt ?? null;
    lastStartedAtRef.current = start;
    setDisplayStartedAt(start);
    if (!isArchive) {
      setLiveActive(true);
      const t = (initialLiveViolationType || 'game_area_exit').trim();
      setLiveViolationType(t || 'game_area_exit');
    }
  }, [
    isOpen,
    pairId,
    initialAssignedNumber,
    initialPairName,
    initialStartedAt,
    initialLiveViolationType,
    isArchive,
  ]);

  useEffect(() => {
    if (!isOpen || pairId == null || isArchive) return;

    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const response = await fetch(apiUrl('/api/rule-violations/active-game-area'), {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const violations = data.violations || [];
        const v = violations.find((x: { pairId: number }) => Number(x.pairId) === Number(pairId));

        if (cancelled) return;

        if (v) {
          setLiveActive(true);
          if (v.assignedNumber != null) setAssignedNumber(v.assignedNumber);
          if (v.pairName !== undefined) setPairName(v.pairName);
          const vt = typeof v.violationType === 'string' && v.violationType.trim() ? v.violationType : 'game_area_exit';
          setLiveViolationType(vt);
          const ca = v.createdAt as string;
          if (ca) {
            lastStartedAtRef.current = ca;
            setDisplayStartedAt(ca);
          }
        } else {
          setLiveActive(false);
          setDisplayStartedAt(lastStartedAtRef.current);
        }
      } catch {
        /* csendes hiba – következő ciklusban újra */
      }
    };

    void fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOpen, pairId, isArchive]);

  const pairLabel =
    assignedNumber != null
      ? `${assignedNumber}. pár${pairName ? ` (${pairName})` : ''}`
      : pairName || 'Ismeretlen pár';

  if (isArchive && archiveSnapshot) {
    const snap = archiveSnapshot;
    const formattedStartArchive = formatDateTimeBudapest(snap.createdAt);
    const formattedResolvedArchive = snap.resolvedAt
      ? formatDateTimeBudapest(snap.resolvedAt)
      : null;
    const typeLabel = TYPE_LABELS[snap.violationType] || snap.violationType;
    const archiveResolved = snap.resolved;
    const modalVariant = archiveModalVariant(snap.violationType, archiveResolved);
    const primaryExpl = archiveExplanationPrimary(snap.violationType, archiveResolved, pairLabel);
    const calloutClass =
      modalVariant === 'red'
        ? 'border-red-500/30 bg-red-500/10 text-red-100'
        : modalVariant === 'green'
          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
          : 'border-orange-500/30 bg-orange-500/10 text-orange-100';
    const accentIconClass =
      modalVariant === 'red' ? 'text-red-400' : modalVariant === 'green' ? 'text-emerald-400' : 'text-orange-400';
    const leadParagraph =
      primaryExpl ??
      (snap.description
        ? `Egyéni vagy ismeretlen szabályszegés-típus (${snap.violationType}). A részleteket a szerver a naplóban rögzítette — lent a szöveges leírás.`
        : `Ismeretlen szabályszegés-típus: ${snap.violationType}. Nincs előre definiált magyarázat ehhez a típushoz, és a naplóban sincs rögzített leírás.`);

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        variant={modalVariant}
        maxWidth="max-w-2xl"
        title={
          <div className="flex items-center gap-4 min-w-0">
            <div
              className={`flex-shrink-0 p-2 rounded-lg flex items-center justify-center ${
                modalVariant === 'red'
                  ? 'bg-red-500/20'
                  : modalVariant === 'green'
                    ? 'bg-emerald-500/20'
                    : 'bg-orange-500/20'
              }`}
            >
              {modalVariant === 'green' ? (
                <FiCheckCircle className={`w-5 h-5 ${accentIconClass}`} />
              ) : modalVariant === 'red' ? (
                <FiAlertTriangle className={`w-5 h-5 ${accentIconClass}`} />
              ) : (
                <FiActivity className={`w-5 h-5 ${accentIconClass}`} />
              )}
            </div>
            <div className="flex flex-col min-w-0 justify-center leading-tight gap-0.5">
              <span className="text-xl font-bold text-white leading-tight">Szabályszegés részletei</span>
              <span className="text-xs sm:text-sm font-normal normal-case tracking-normal text-gray-400 leading-snug">
                Naplóbejegyzés (ID #{snap.violationId}) · {typeLabel}
              </span>
            </div>
          </div>
        }
      >
        <div className="p-6 space-y-5">
          <div className={`rounded-xl border p-4 ${calloutClass}`}>
            <p className="font-semibold leading-relaxed">{emphasisPairInLead(leadParagraph, pairLabel)}</p>
          </div>

          {snap.description ? (
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">
                Naplóban rögzített leírás (szerver)
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{snap.description}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                <FiMapPin className={`w-3 h-3 shrink-0 ${accentIconClass}`} /> Érintett páros
              </div>
              <div className="text-sm text-white font-semibold break-words">{pairLabel}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                <FiClock className={`w-3 h-3 shrink-0 ${accentIconClass}`} /> Kezdete
              </div>
              <div className="text-sm text-white font-semibold">{formattedStartArchive}</div>
            </div>
            {archiveResolved ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                  <FiCheckCircle className={`w-3 h-3 shrink-0 ${accentIconClass}`} /> Lezárva
                </div>
                <div
                  className={`text-sm font-semibold ${modalVariant === 'green' ? 'text-emerald-300' : 'text-white'}`}
                >
                  {formattedResolvedArchive || '—'}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                  <FiActivity className={`w-3 h-3 shrink-0 ${accentIconClass}`} /> Állapot (napló)
                </div>
                <div
                  className={`text-sm font-bold ${modalVariant === 'orange' ? 'text-orange-400' : 'text-red-400'}`}
                >
                  Aktív
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  const formattedStartLive = formatDateTimeBudapest(displayStartedAt);
  const liveLead = liveCalloutPrimary(liveViolationType, liveActive, pairLabel);
  const liveAccent = liveActive ? 'text-red-400' : 'text-emerald-400';
  const liveBorder = liveActive ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/35 bg-emerald-500/10';
  const liveTextTone = liveActive ? 'text-red-100' : 'text-emerald-100';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant={liveActive ? 'red' : 'green'}
      maxWidth="max-w-2xl"
      title={
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`flex-shrink-0 p-2 rounded-lg flex items-center justify-center ${
              liveActive ? 'bg-red-500/20' : 'bg-emerald-500/20'
            }`}
          >
            {liveActive ? (
              <FiAlertTriangle className="w-5 h-5 text-red-400" />
            ) : (
              <FiCheckCircle className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div className="flex flex-col min-w-0 justify-center leading-tight gap-0.5">
            <span className="text-xl font-bold text-white leading-tight">Szabályszegés részletei</span>
            <span
              className={`text-xs sm:text-sm font-normal normal-case tracking-normal leading-snug ${
                liveActive ? 'text-red-300/85' : 'text-emerald-300/90'
              }`}
            >
              {liveTitleSubtitle(liveViolationType, liveActive)}
            </span>
          </div>
        </div>
      }
    >
      <div className="p-6 space-y-5">
        <div className={`rounded-xl border p-4 ${liveBorder}`}>
          <p className={`${liveTextTone} font-semibold leading-relaxed`}>
            {emphasisPairInLead(liveLead, pairLabel)}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Típus (élő)</span>
          <span className="text-sm text-gray-200 font-medium">{TYPE_LABELS[liveViolationType] || liveViolationType}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
              <FiMapPin className={`w-3 h-3 shrink-0 ${liveAccent}`} /> Érintett páros
            </div>
            <div className="text-sm text-white font-semibold break-words">{pairLabel}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
              <FiClock className={`w-3 h-3 shrink-0 ${liveAccent}`} /> {liveActive ? 'Kezdete' : 'Szabályszegés kezdete'}
            </div>
            <div className="text-sm text-white font-semibold">{formattedStartLive}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
              <FiActivity className={`w-3 h-3 shrink-0 ${liveAccent}`} /> Állapot
            </div>
            <div className={`text-sm font-bold ${liveAccent}`}>{liveActive ? 'Aktív' : 'Megoldódott'}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
