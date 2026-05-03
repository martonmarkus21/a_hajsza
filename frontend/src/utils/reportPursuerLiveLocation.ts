import { apiUrl } from '@/config/env';
import { authService } from '@/services/auth';

let lastSentAt = 0;
const INTERVAL_MS = 25000;

/** Web böngésző GPS → backend Redis (napi zárás FCM távolságszámításhoz). Közösen throttle-olva. */
export function maybeReportPursuerLiveLocation(lat: number, lon: number): void {
  const u = authService.getCurrentUser();
  if (!u || (u.role !== 'admin' && u.role !== 'officer')) return;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const token = localStorage.getItem('token');
  if (!token) return;

  const now = Date.now();
  if (now - lastSentAt < INTERVAL_MS) return;
  lastSentAt = now;

  void fetch(apiUrl('/api/positions/pursuer-live'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ lat, lon }),
  }).catch(() => {
    /* csendben */
  });
}
