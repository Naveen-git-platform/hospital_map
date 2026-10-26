import type { LatLng } from "./types";

const SAVED_KEY = "caremap:last-location";
const SAVED_MAX_AGE = 7 * 24 * 3600 * 1000;

export interface ApproxLocation extends LatLng {
  city?: string;
}

/**
 * Rough location from the visitor's network, via the Vercel edge function in api/geo.ts.
 * No permission prompt; city-level accuracy. Resolves null if unavailable (e.g. local dev, GitHub Pages).
 */
export async function fetchApproxLocation(timeoutMs = 1500): Promise<ApproxLocation | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("/api/geo", { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return null;
    const data = (await res.json()) as Partial<ApproxLocation>;
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return null;
    return { lat: data.lat, lng: data.lng, city: data.city || undefined };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function loadSavedLocation(): LatLng | null {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as LatLng & { at: number };
    if (Date.now() - saved.at > SAVED_MAX_AGE) return null;
    return { lat: saved.lat, lng: saved.lng };
  } catch {
    return null;
  }
}

export function saveLocation(loc: LatLng) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify({ ...loc, at: Date.now() }));
  } catch {
    // Storage unavailable; the next visit simply asks again.
  }
}

export type LocateError = "denied" | "unavailable";

/**
 * Asks the browser for the visitor's position: a fast, coarse fix first, then a precise one.
 * `onFix` may be called twice. Returns a function that cancels pending callbacks.
 */
export function requestPosition(onFix: (loc: LatLng, precise: boolean) => void, onError: (e: LocateError) => void) {
  if (!("geolocation" in navigator)) {
    onError("unavailable");
    return () => {};
  }
  let active = true;
  let gotFix = false;
  const toLoc = (p: GeolocationPosition): LatLng => ({ lat: p.coords.latitude, lng: p.coords.longitude });
  const fail = (e: GeolocationPositionError) => {
    if (active && !gotFix) onError(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable");
  };
  navigator.geolocation.getCurrentPosition(
    (p) => {
      if (!active) return;
      gotFix = true;
      onFix(toLoc(p), false);
      navigator.geolocation.getCurrentPosition(
        (precise) => {
          if (active) onFix(toLoc(precise), true);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    },
    fail,
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
  );
  return () => {
    active = false;
  };
}
