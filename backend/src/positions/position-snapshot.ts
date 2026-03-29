/**
 * In-memory / Redis payload for a GPS fix (no DB id).
 * Used for rule checks and live tracking without persisting every tick.
 */
export type PositionSnapshot = {
  lat: number;
  lon: number;
  accuracy?: number | null;
  speed?: number | null;
  vehicleMode?: boolean;
  vehicleSessionRemaining?: number | null;
  timestamp: Date;
};
