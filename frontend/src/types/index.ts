export interface Pair {
  id: number;
  assignedNumber: number;
  name: string | null;
  active: boolean;
  captured: boolean;
  mostWanted: boolean;
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
}


