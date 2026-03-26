import { useEffect, useRef, useState } from 'react';
import { FiAlertTriangle, FiMapPin, FiClock, FiActivity, FiCheckCircle } from 'react-icons/fi';
import Modal from './Modal';
import { formatDateTimeBudapest } from '../utils/formatDateTimeBudapest';

const TYPE_LABELS: Record<string, string> = {
  game_area_exit: 'Játékterület elhagyása',
  vehicle_time_exceeded: 'Járműhasználat',
};

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
  archiveSnapshot,
}: RuleViolationDetailsModalProps) {
  const isArchive = archiveSnapshot != null;

  const [liveActive, setLiveActive] = useState(true);
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
    }
  }, [isOpen, pairId, initialAssignedNumber, initialPairName, initialStartedAt, isArchive]);

  useEffect(() => {
    if (!isOpen || pairId == null || isArchive) return;

    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/rule-violations/active-game-area', {
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
    const isGameArea = snap.violationType === 'game_area_exit';
    const modalVariant = !isGameArea ? 'orange' : archiveResolved ? 'green' : 'red';

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
                !isGameArea
                  ? 'bg-orange-500/20'
                  : archiveResolved
                    ? 'bg-emerald-500/20'
                    : 'bg-red-500/20'
              }`}
            >
              {!isGameArea ? (
                <FiActivity className="w-5 h-5 text-orange-400" />
              ) : archiveResolved ? (
                <FiCheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <FiAlertTriangle className="w-5 h-5 text-red-400" />
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
          {isGameArea ? (
            archiveResolved ? (
              <>
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4">
                  <p className="text-emerald-100 font-semibold leading-relaxed">
                    A(z) <span className="text-white">{pairLabel}</span> ezen a bejegyzés szerint már visszatért a
                    játékterületre — a szabályszegés lezárult. (A párnak jelenleg lehet másik, aktív figyelmeztetése is
                    a térképen; ez a nézet mindig ehhez a naplósorhoz tartozik.)
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                      <FiMapPin className="w-3 h-3 text-emerald-400 shrink-0" /> Érintett páros
                    </div>
                    <div className="text-sm text-white font-semibold break-words">{pairLabel}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                      <FiClock className="w-3 h-3 text-emerald-400 shrink-0" /> Kezdete
                    </div>
                    <div className="text-sm text-white font-semibold">{formattedStartArchive}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                      <FiCheckCircle className="w-3 h-3 text-emerald-400 shrink-0" /> Lezárva
                    </div>
                    <div className="text-sm text-emerald-300 font-semibold">{formattedResolvedArchive || '—'}</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                  <p className="text-red-100 font-semibold leading-relaxed">
                    A(z) <span className="text-white">{pairLabel}</span> ezen bejegyzés szerint elhagyta az aktív
                    játékterületet. A lent látható időpontok ehhez a konkrét naplósorhoz tartoznak — nem az esetleges
                    jelenlegi, élő figyelmeztetéshez.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                      <FiMapPin className="w-3 h-3 text-red-400 shrink-0" /> Érintett páros
                    </div>
                    <div className="text-sm text-white font-semibold break-words">{pairLabel}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                      <FiClock className="w-3 h-3 text-red-400 shrink-0" /> Kezdete
                    </div>
                    <div className="text-sm text-white font-semibold">{formattedStartArchive}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                      <FiActivity className="w-3 h-3 text-red-400 shrink-0" /> Állapot (napló)
                    </div>
                    <div className="text-sm text-red-400 font-bold">Aktív</div>
                  </div>
                </div>
              </>
            )
          ) : (
            <>
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                <p className="text-orange-100 font-semibold leading-relaxed">
                  {snap.description || 'Nincs részletes leírás.'}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Típus</div>
                  <div className="text-sm text-white font-semibold">{typeLabel}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Állapot</div>
                  <div className={`text-sm font-bold ${archiveResolved ? 'text-emerald-400' : 'text-red-400'}`}>
                    {archiveResolved ? 'Lezárt' : 'Aktív'}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                    <FiClock className="w-3 h-3 shrink-0" /> Kezdete
                  </div>
                    <div className="text-sm text-white font-semibold">{formattedStartArchive}</div>
                </div>
                {archiveResolved && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Lezárva</div>
                    <div className="text-sm text-white font-semibold">{formattedResolvedArchive || '—'}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    );
  }

  const formattedStartLive = formatDateTimeBudapest(displayStartedAt);

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
              {liveActive ? 'Aktív játéktér elhagyása' : 'A szabályszegés megszűnt'}
            </span>
          </div>
        </div>
      }
    >
      <div className="p-6 space-y-5">
        {liveActive ? (
          <>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-red-100 font-semibold leading-relaxed">
                A(z) <span className="text-white">{pairLabel}</span> elhagyta az aktív játékterületet. A szabály szerint
                Ön és a többi üldöző folyamatos, valós idejű pozíciófrissítést lát erről a párról a térképen, a szokásos
                lokációfrissítési számlálótól függetlenül.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                  <FiMapPin className="w-3 h-3 text-red-400 shrink-0" /> Érintett páros
                </div>
                <div className="text-sm text-white font-semibold break-words">{pairLabel}</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                  <FiClock className="w-3 h-3 text-red-400 shrink-0" /> Kezdete
                </div>
                <div className="text-sm text-white font-semibold">{formattedStartLive}</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                  <FiActivity className="w-3 h-3 text-red-400 shrink-0" /> Állapot
                </div>
                <div className="text-sm text-red-400 font-bold">Aktív</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4">
              <p className="text-emerald-100 font-semibold leading-relaxed">
                A(z) <span className="text-white">{pairLabel}</span> visszatért az aktív játékterületre. A
                szabályszegés megszűnt: a páros pozíciója ismét a normál lokációfrissítési szabályok szerint jelenik meg
                a térképen.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                  <FiMapPin className="w-3 h-3 text-emerald-400 shrink-0" /> Érintett páros
                </div>
                <div className="text-sm text-white font-semibold break-words">{pairLabel}</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                  <FiClock className="w-3 h-3 text-emerald-400 shrink-0" /> Szabályszegés kezdete
                </div>
                <div className="text-sm text-white font-semibold">{formattedStartLive}</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 flex items-center gap-1">
                  <FiActivity className="w-3 h-3 text-emerald-400 shrink-0" /> Állapot
                </div>
                <div className="text-sm text-emerald-400 font-bold">Megoldódott</div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
