/** `GeolocationPositionError` DOM kódok: 1 = denied, 2 = unavailable, 3 = timeout */
export function logGeolocationError(context: string, error: GeolocationPositionError): void {
  const code = (error as GeolocationPositionError)?.code;
  if (code === 2 || code === 3) {
    return;
  }
  if (code === 1) {
    console.warn(`[geolocation] ${context}: engedély megtagadva`);
    return;
  }
  console.error(`[geolocation] ${context}:`, error);
}
