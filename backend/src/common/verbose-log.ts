/**
 * Opt-in debug logging (position spam, auth traces). Production: leave unset.
 * Set LOG_VERBOSE=true or 1 in .env when debugging.
 */
export function isLogVerbose(): boolean {
  const v = (process.env.LOG_VERBOSE || '').toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes';
}

export function logVerbose(...args: unknown[]): void {
  if (isLogVerbose()) {
    console.log(...args);
  }
}
