// Access control for when the agent is exposed through a tunnel (cloudflared) to the Vercel dashboard.
import { timingSafeEqual } from "node:crypto";

const PROXY_HEADERS = ["x-forwarded-for", "cf-connecting-ip", "x-real-ip"];

export type Headers = Record<string, string | string[] | undefined>;

export function isLoopback(addr: string | undefined): boolean {
  if (!addr) return false;
  const a = addr.toLowerCase();
  return a === "::1" || a.startsWith("127.") || a.startsWith("::ffff:127.");
}

/** Local = loopback socket AND no proxy headers (a tunnel connects from loopback but adds them). */
export function isLocalRequest(remoteAddress: string | undefined, headers: Headers): boolean {
  return isLoopback(remoteAddress) && !PROXY_HEADERS.some((h) => headers[h] !== undefined);
}

export type AccessResult = { ok: true } | { ok: false; code: 401 | 403; error: string };

/** For mutating endpoints: local requests pass; remote ones need x-guardia-key == GUARDIA_API_KEY. */
export function checkWriteAccess(remoteAddress: string | undefined, headers: Headers, apiKey: string): AccessResult {
  if (isLocalRequest(remoteAddress, headers)) return { ok: true };
  if (!apiKey) return { ok: false, code: 403, error: "remote writes are disabled (GUARDIA_API_KEY not set)" };
  const got = headers["x-guardia-key"];
  const key = Array.isArray(got) ? got[0] : got;
  if (!key) return { ok: false, code: 401, error: "missing x-guardia-key" };
  const a = Buffer.from(key);
  const b = Buffer.from(apiKey);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, code: 403, error: "invalid x-guardia-key" };
  return { ok: true };
}

export const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];
const VERCEL_RE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/i;

/** ALLOWED_ORIGINS (comma-separated) replaces the default list; any https://*.vercel.app is allowed only by default. */
export function originAllowed(origin: string | undefined, allowedEnv: string | undefined): boolean {
  if (!origin) return true; // curl, server-to-server, same-origin: no CORS involved
  const list = (allowedEnv ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  if (list.length) return list.includes(origin.replace(/\/$/, ""));
  return DEFAULT_ALLOWED_ORIGINS.includes(origin) || VERCEL_RE.test(origin);
}
