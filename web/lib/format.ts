const nf = (digits: number) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Amounts are decimal strings in human units. ARGt shows no decimals, others two. */
export function formatAmount(value: string | number, currency?: string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  const digits = currency === "ARGt" || (currency === undefined && Number.isInteger(n)) ? 0 : 2;
  return nf(digits).format(n);
}

export function formatMoney(value: string | number, currency: string): string {
  return `${currency} ${formatAmount(value, currency)}`;
}

export function shortAddress(addr: string, head = 4, tail = 4): string {
  if (!addr || addr.length <= 2 + head + tail) return addr;
  return `${addr.slice(0, 2 + head)}…${addr.slice(-tail)}`;
}

export function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

const COUNTRY: Record<string, string> = { AR: "Argentina", BR: "Brasil", CO: "Colombia", PE: "Perú", MX: "México", CL: "Chile", BO: "Bolivia" };
export function countryName(code: string): string {
  return COUNTRY[code] ?? "Origen desconocido";
}
