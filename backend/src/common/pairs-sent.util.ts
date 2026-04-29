/**
 * `game_runtime_state.pairs_sent_position_this_cycle` (TypeORM simple-array) → number[]
 */
export function parsePairsSentIds(
  pairsSent: number[] | string | null | undefined,
): number[] {
  if (pairsSent == null) return [];
  if (Array.isArray(pairsSent)) return pairsSent;
  const s = String(pairsSent).trim();
  if (s === '') return [];
  return s
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id));
}
