/** Shared NIM address rules (server + client-safe). */

export function normalizeNimiqAddress(addr) {
  return String(addr || '').replace(/\s+/g, '').toUpperCase();
}

export function isValidNimiqAddress(addr) {
  const n = normalizeNimiqAddress(addr);
  if (!/^NQ[0-9A-Z]{34}$/.test(n)) return false;
  if (/DEMO|ESCROW|PLAT|TEST|XXXX|PREVIEW/i.test(n)) return false;
  return true;
}
