/** DB / köztes rétegből érkező „logikai” érték normalizálása API-válaszokhoz. */
export function coerceBooleanFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 't' || s === 'yes';
  }
  return false;
}
