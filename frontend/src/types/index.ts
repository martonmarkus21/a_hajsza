export interface Pair {
  id: number;
  assignedNumber: number;
  name: string | null;
  active: boolean;
  captured: boolean;
  celkereszt: boolean;
  lastPosition: {
    lat: number;
    lon: number;
    timestamp: string;
  } | null;
  distancePosition?: {
    lat: number;
    lon: number;
    timestamp: string;
  } | null;
  distanceToNearestOfficer: number | null;
  hasActiveDevice?: boolean;
  captureNote?: string | null;
  captureTimestamp?: string | null;
  captureId?: number | null;
  capturedByUserId?: number | null;
  capturedByUsername?: string | null;
  capturedByRole?: string | null;
  captureLocation?: { lat: number; lon: number } | null;
}


