/** Megegyezik az Android [MobileConnectionQrParser] formátumával: CK1: + base64url(UTF-8 JSON). */
const PREFIX = 'CK1:';

export function encodeCkMobileQrPayload(apiBaseUrl: string, enrollmentSecret: string): string {
  const u = apiBaseUrl.replace(/\s+$/, '').replace(/\/+$/, '');
  const s = enrollmentSecret.trim();
  const payload: { u: string; s?: string } = { u };
  if (s) payload.s = s;
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return PREFIX + b64;
}
