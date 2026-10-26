import { around } from "geokdbush";
import KDBush from "kdbush";
import { geometryBounds, HOSPITALS, SEATS_GEOJSON } from "./data";
import type { Hospital, LatLng, SeatGeometry } from "./types";

// ---------------------------------------------------------------------------
// Point → constituency
// ---------------------------------------------------------------------------

function inRing(x: number, y: number, ring: GeoJSON.Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi = 0, yi = 0] = ring[i];
    const [xj = 0, yj = 0] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inGeometry(lng: number, lat: number, geom: SeatGeometry) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return polys.some((rings) => inRing(lng, lat, rings[0] ?? []) && !rings.slice(1).some((hole) => inRing(lng, lat, hole)));
}

let seatBoxes: { id: string; geom: SeatGeometry; box: [[number, number], [number, number]] }[] | null = null;

/** Constituency id containing the point, or null when outside Telangana. */
export function seatAt({ lng, lat }: LatLng): string | null {
  seatBoxes ??= SEATS_GEOJSON.features.map((f) => ({ id: f.id, geom: f.geometry, box: geometryBounds(f.geometry) }));
  for (const s of seatBoxes) {
    const [[x0, y0], [x1, y1]] = s.box;
    if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue;
    if (inGeometry(lng, lat, s.geom)) return s.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Distances and nearest facilities
// ---------------------------------------------------------------------------

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round(km * 20) * 50)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

let index: { tree: KDBush; items: Hospital[] } | null = null;

function spatialIndex() {
  if (!index) {
    const items = HOSPITALS.filter((h) => !h.offMap);
    const tree = new KDBush(items.length);
    for (const h of items) tree.add(h.lng, h.lat);
    tree.finish();
    index = { tree, items };
  }
  return index;
}

/** Nearest facilities to a point, closest first. */
export function nearest(
  at: LatLng,
  count: number,
  predicate: (h: Hospital) => boolean,
  maxKm = 100,
): { hospital: Hospital; km: number }[] {
  const { tree, items } = spatialIndex();
  const ids = around(tree, at.lng, at.lat, count, maxKm, (i: number) => predicate(items[i]));
  return ids.map((i: number) => ({ hospital: items[i], km: distanceKm(at, items[i]) }));
}
