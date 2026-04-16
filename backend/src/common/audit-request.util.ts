import type { Request } from 'express';

/** Kiegészítő meta audit naplózáshoz (HTTP kérésből). */
export type AuditRequestMeta = { ipAddress?: string; userAgent?: string };

/**
 * Kiolvassa a kliens IP-jét és a User-Agent fejlécet (X-Forwarded-For, IPv4/IPv6).
 */
export function auditMetaFromRequest(req?: Request): AuditRequestMeta {
  if (!req) return {};
  const forwarded = req.headers['x-forwarded-for'];
  let ip = '';
  if (typeof forwarded === 'string' && forwarded.trim()) {
    ip = forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded[0]) {
    ip = String(forwarded[0]).trim();
  }
  if (!ip && typeof req.ip === 'string' && req.ip) {
    ip = req.ip;
  }
  if (!ip && req.socket?.remoteAddress) {
    ip = String(req.socket.remoteAddress);
  }
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  const uaRaw = req.headers['user-agent'];
  const userAgent = typeof uaRaw === 'string' ? uaRaw.slice(0, 4000) : undefined;
  return {
    ipAddress: ip ? ip.slice(0, 45) : undefined,
    userAgent,
  };
}
