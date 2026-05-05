/** Leaflet divIcon HTML: páros szám + opcionális piros szabályszegés-jelző (bal felső). */

const ALERT_SVG =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

export function buildPairMarkerDivHtml(options: {
  assignedNumber: number;
  celkereszt: boolean;
  hasViolation: boolean;
  captured?: boolean;
  size?: number;
  fontSize?: number;
  borderWidth?: number;
  borderColor?: string;
}): string {
  const size = options.size ?? 32;
  const fontSize = options.fontSize ?? 18;
  const borderWidth = options.borderWidth ?? 3;
  const borderColor = options.captured ? '#dc2626' : options.borderColor ?? '#f97316';
  const bg = options.captured ? '#dc2626' : options.celkereszt ? '#f97316' : '#2a2a2a';

  const violationBadge = options.hasViolation
    ? `<div aria-hidden="true" style="position:absolute;top:-5px;left:-5px;width:18px;height:18px;border-radius:50%;background:rgba(239,68,68,0.95);border:1px solid rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.35);">${ALERT_SVG}</div>`
    : '';

  return `<div style="position:relative;width:${size}px;height:${size}px;">
<div style="background-color:${bg};width:${size}px;height:${size}px;border-radius:50%;border:${borderWidth}px solid ${borderColor};display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:${fontSize}px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${options.assignedNumber}</div>${violationBadge}</div>`;
}
