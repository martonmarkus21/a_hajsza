import type { Pair } from '../types';

/** Keep live socket updates when newer; otherwise accept API (e.g. re-entry row after violation resolve). */
export function mergeLastPosition(
  persisted: Pair['lastPosition'],
  fromApi: Pair['lastPosition'],
): Pair['lastPosition'] {
  if (!fromApi) return persisted ?? null;
  if (!persisted) return fromApi;
  const tApi = new Date(fromApi.timestamp).getTime();
  const tPersisted = new Date(persisted.timestamp).getTime();
  return tPersisted >= tApi ? persisted : fromApi;
}
