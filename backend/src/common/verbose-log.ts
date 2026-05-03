/**
 * Opt-in debug logging (WebSocket, FCM, device auth, guards). Production: leave unset.
 * Set LOG_VERBOSE=true or 1 — does not enable position/createPosition logs (use LOG_VERBOSE_POSITION).
 */
export function isLogVerbose(): boolean {
  const v = (process.env.LOG_VERBOSE || '').toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes';
}

/** Position/createPosition flow logs — separate from LOG_VERBOSE so the console stays quiet unless explicitly enabled (default off). */
export function isLogVerbosePosition(): boolean {
  const v = (process.env.LOG_VERBOSE_POSITION || '').toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes';
}

export function logVerbose(...args: unknown[]): void {
  if (isLogVerbose()) {
    console.log(...args);
  }
}

export function logVerbosePosition(...args: unknown[]): void {
  if (isLogVerbosePosition()) {
    console.log(...args);
  }
}

const positionThrottleLastAt = new Map<string, number>();

/** Limits per-pair summary spam when position verbose is on (~1 line / 15 s / pair). Not configurable via .env. */
const POSITION_VERBOSE_THROTTLE_MS = 15000;

export function logVerbosePositionThrottled(key: string, ...args: unknown[]): void {
  if (!isLogVerbosePosition()) {
    return;
  }
  const now = Date.now();
  const last = positionThrottleLastAt.get(key) ?? 0;
  if (now - last < POSITION_VERBOSE_THROTTLE_MS) {
    return;
  }
  positionThrottleLastAt.set(key, now);
  console.log(...args);
}
