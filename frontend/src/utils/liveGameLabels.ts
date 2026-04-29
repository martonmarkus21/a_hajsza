/**
 * Egységes, magyar címkék a játékmotor / játéknap állapotához (főoldal + admin).
 * A backend JSON mező neve továbbra is `campaignStatus`; a UI-ban „játékmotor fázis”-ként érdemes gondolni rá.
 */
export type LiveGameStatusVariant = 'live' | 'paused' | 'off' | 'warn' | 'idle';

export function liveGameStatusHeadline(opts: {
  gameEnabled?: boolean;
  isGameActive?: boolean;
  /** API: `campaignStatus` — a játékmotor aktuális fázisa (RUNNING, IDLE, …). */
  motorPhase?: string | null;
  isPastLastScheduledGameEnd?: boolean;
}): { headline: string; detail?: string; variant: LiveGameStatusVariant } {
  const { gameEnabled, isGameActive, motorPhase, isPastLastScheduledGameEnd } = opts;
  const c = motorPhase ?? null;

  if (isPastLastScheduledGameEnd) {
    return {
      headline: 'Ütemezés vége',
      detail: 'Az utolsó játéknap záróideje lejárt.',
      variant: 'warn',
    };
  }
  if (!gameEnabled) {
    return {
      headline: 'Motor leállítva',
      detail: 'A játék nincs engedélyezve.',
      variant: 'off',
    };
  }
  if (isGameActive) {
    return {
      headline: 'Folyamatban',
      detail: undefined,
      variant: 'live',
    };
  }
  if (c === 'FINISHED') {
    return { headline: 'Játék lezárva', detail: undefined, variant: 'idle' };
  }
  if (c === 'PAUSED_BETWEEN_DAYS') {
    return {
      headline: 'Napi szünet',
      detail: 'Motor bekapcsolva, jelenleg nincs aktív játékablak.',
      variant: 'paused',
    };
  }
  if (c === 'RUNNING') {
    return {
      headline: 'Várakozás',
      detail: undefined,
      variant: 'paused',
    };
  }
  return {
    headline: 'Várakozás',
    detail: c && c !== 'IDLE' ? `Technikai kód: ${c}` : undefined,
    variant: 'idle',
  };
}

/** Emberi szöveg a játékmotor fázisához (API értékek: RUNNING, IDLE, …). */
export function motorPhaseLabelHu(status: string | null | undefined): string {
  switch (status) {
    case 'RUNNING':
      return 'Fut — aktív követési ciklus';
    case 'IDLE':
      return 'Tétlen';
    case 'PAUSED_BETWEEN_DAYS':
      return 'Játéknapok között';
    case 'FINISHED':
      return 'Lezárva (ütemezés vége)';
    default:
      return status ? String(status) : '—';
  }
}

export function mapPositionWindowLabelHu(allow: boolean | undefined): { label: string; variant: 'open' | 'closed' } {
  if (allow === true) {
    return { label: 'Lokáció fogadása: nyitva', variant: 'open' };
  }
  return { label: 'Lokáció fogadása: zárva', variant: 'closed' };
}
