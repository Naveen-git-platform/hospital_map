import clinicsJson from "../data/clinics.json";
import seatsJson from "../data/constituencies.json";
import hospitalsJson from "../data/hospitals.json";
import seatGuidesJson from "../data/seat-guides.json";
import { survey } from "../data/survey";
import type {
  FilterId,
  Hospital,
  HospitalKind,
  MarkerKind,
  SeatCollection,
  SeatFeature,
  SeatGuide,
  SeatProps,
} from "./types";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** Curated hospitals first, then the Telangana health-centre file rows. */
export const HOSPITALS: Hospital[] = [...(hospitalsJson as Hospital[]), ...(clinicsJson as Hospital[])];
export const SEATS_GEOJSON = seatsJson as unknown as SeatCollection;
export const SEAT_GUIDES = seatGuidesJson as Record<string, SeatGuide>;

export const SEATS: SeatProps[] = SEATS_GEOJSON.features
  .map((f) => f.properties)
  .sort((a, b) => a.name.localeCompare(b.name));

const hospitalById = new Map(HOSPITALS.map((h) => [h.id, h]));
const seatById = new Map(SEATS.map((s) => [s.id, s]));
const seatFeatureById = new Map(SEATS_GEOJSON.features.map((f) => [f.id, f]));

export const getHospital = (id: string) => hospitalById.get(id);
export const getSeat = (id: string) => seatById.get(id);
export const getSeatFeature = (id: string): SeatFeature | undefined => seatFeatureById.get(id);

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type FilterGroupId = "areas" | "hospitals" | "clinics" | "care";

/** Filters grouped into the panel's tabs. The first filter of a group is its default. */
export const FILTER_GROUPS: { id: FilterGroupId; label: string; filters: { id: FilterId; label: string }[] }[] = [
  { id: "areas", label: "Areas", filters: [{ id: "about", label: "Constituencies" }] },
  {
    id: "hospitals",
    label: "Hospitals",
    filters: [
      { id: "all", label: "All" },
      { id: "trusted", label: "Top rated" },
      { id: "government", label: "Government" },
      { id: "corporate", label: "Corporate" },
      { id: "trust", label: "Trust & NGO" },
      { id: "midsized", label: "Mid-size" },
      { id: "military", label: "Military" },
      { id: "projects", label: "Upcoming" },
    ],
  },
  {
    id: "clinics",
    label: "Clinics",
    filters: [
      { id: "wellness", label: "Wellness" },
      { id: "primary", label: "Primary" },
      { id: "community", label: "Community" },
      { id: "subcentre", label: "Sub-centres" },
      { id: "dispensary", label: "Dispensaries" },
    ],
  },
  {
    id: "care",
    label: "Care",
    filters: [
      { id: "emergency", label: "Emergency" },
      { id: "heart", label: "Heart" },
      { id: "cancer", label: "Cancer" },
      { id: "women-child", label: "Women & child" },
    ],
  },
];

export const groupOfFilter = (f: FilterId): FilterGroupId =>
  FILTER_GROUPS.find((g) => g.filters.some((x) => x.id === f))?.id ?? "areas";

export const FILTER_INTROS: Record<Exclude<FilterId, "about">, { title: string; line: string }> = {
  all: {
    title: "All hospitals",
    line: "Every campus on this map, grouped by the constituency colour it falls in.",
  },
  government: {
    title: "Government and public hospitals",
    line: "State and central hospitals that treat at a nominal fee or free. Community centres and primary clinics are under their own filters.",
  },
  corporate: {
    title: "Private corporate hospitals",
    line: "The large company-run hospitals: Apollo, Yashoda, KIMS, AIG, CARE, Continental, and the other chains.",
  },
  trust: {
    title: "NGO, trust and charitable hospitals",
    line: "Hospitals run by a trust, a mission or a medical college society. They are not government hospitals.",
  },
  military: {
    title: "Military and defence hospitals",
    line: "Army, air force and defence hospitals. Apollo DRDO is included. These are not walk-in public hospitals.",
  },
  midsized: {
    title: "Mid-size and small hospitals",
    line: "Private hospitals that are not part of the large corporate chains.",
  },
  community: {
    title: "Health centres",
    line: "Community health centres from the Telangana health-centre file, plus the ones already on this map.",
  },
  primary: {
    title: "Primary centres",
    line: "Primary health centres and urban primary centres. Local government clinics, not big hospitals.",
  },
  wellness: {
    title: "Wellness clinics",
    line: "Urban health and wellness clinics, including Basti Dawakhanas, from the health-centre file.",
  },
  subcentre: {
    title: "Sub-centres",
    line: "The smallest government clinics in the health-centre file. One nurse post, not a hospital.",
  },
  dispensary: {
    title: "Dispensaries",
    line: "Ayurveda, homoeopathy, Unani and other government dispensaries.",
  },
  projects: {
    title: "Projects",
    line: "New campuses and sites still being built, including the TIMS plan.",
  },
  trusted: {
    title: "Top hospitals",
    line: "KIMS, Apollo Jubilee Hills, Yashoda at Somajiguda, Secunderabad and Malakpet, NIMS, and AIG.",
  },
  heart: { title: "Heart", line: "Hospitals this study marks for heart care." },
  cancer: { title: "Cancer", line: "Hospitals this study marks for cancer care." },
  "women-child": { title: "Women and child", line: "Maternity and children’s hospitals." },
  emergency: {
    title: "Emergency",
    line: "Hospitals marked for emergency care. For an ambulance, call 108.",
  },
};

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const TRUST_IDS = new Set([
  "owaisi",
  "princess-esra",
  "basavatarakam",
  "usha",
  "rvm-laxmakkapally",
  "lv-prasad",
  "mahavir",
  "durgabai",
  "st-theresa",
  "mediciti",
]);
const MILITARY_IDS = new Set(["apollo-drdo", "mh-secunderabad", "af-dundigal"]);
const MIDSIZED_IDS = new Set([
  "apna-santosh",
  "dharani",
  "pulse",
  "navodaya",
  "prasad-kphb",
  "russh",
  "tulasi-kushaiguda",
  "ankura-kphb",
  "sindhu",
  "pace-hitec",
  "ozone-kothapet",
]);

type PinRole = "closed" | "anchor" | "project" | "trusted" | "campus";

function pinRole(h: Hospital): PinRole {
  if (h.closed) return "closed";
  if (h.phase === "open" && h.tier === "public") return "anchor";
  if (h.project) return "project";
  if (h.lead && h.tier !== "public") return "trusted";
  if (h.tier === "public") return "anchor";
  return "campus";
}

/** Visual marker category, shared by map pins, list badges and the map key. */
export function markerKind(h: Hospital): MarkerKind {
  if (h.clinic) return h.closed ? "closed" : "clinic";
  switch (pinRole(h)) {
    case "project":
      return "project";
    case "closed":
      return "closed";
    case "anchor":
      return "govt";
    case "trusted":
      return "leading";
    default:
      return "private";
  }
}

function listPriority(h: Hospital): number {
  if (h.closed && !h.clinic) return 0;
  if (h.project) return 1;
  if (h.tier === "public") return 2;
  if (h.lead) return 3;
  return 4;
}

const leadOrder = (h: Hospital) => h.lead ?? 99;

export function hospitalKind(h: Hospital): HospitalKind | null {
  if (h.clinic || h.id.startsWith("chc-") || h.id.startsWith("phc-")) return null;
  if (MILITARY_IDS.has(h.id)) return "military";
  if (TRUST_IDS.has(h.id)) return "trust";
  if (h.tier === "public") return "government";
  if (MIDSIZED_IDS.has(h.id)) return "midsized";
  return "corporate";
}

const CLINIC_LABELS = {
  community: "Health centre",
  primary: "Primary centre",
  wellness: "Wellness clinic",
  subcentre: "Sub-centre",
  dispensary: "Dispensary",
} as const;

/** Short status line, e.g. "Corporate" or "Under construction". */
export function statusLabel(h: Hospital): string {
  if (h.clinic) {
    const label = CLINIC_LABELS[h.clinic];
    return h.closed ? `${label} · not working` : label;
  }
  if (h.closed) return "Closed";
  if (h.offMap && h.phase === "building") return "Under construction · outside this map";
  if (h.phase === "open") return "Open · government";
  if (h.phase === "building") return "Under construction";
  // hospitalKind is null only for chc-/phc- campuses, which fall through below.
  switch (hospitalKind(h)) {
    case "government":
      return "Government";
    case "corporate":
      return "Corporate";
    case "trust":
      return "Trust or charitable";
    case "military":
      return "Military";
    case "midsized":
      return "Mid-size";
  }
  if (h.project) return h.tier === "public" ? "Government project" : "New private campus";
  if (h.lead) return h.tier === "public" ? "Leading government" : "Leading hospital";
  if (h.tier === "public") return "Government";
  return h.tier === "flagship" ? "Private campus" : "Specialty";
}

export function matchesFilter(h: Hospital, filter: FilterId): boolean {
  switch (filter) {
    case "community":
      return h.clinic === "community" || h.id.startsWith("chc-");
    case "primary":
      return h.clinic === "primary" || h.id.startsWith("phc-");
    case "wellness":
    case "subcentre":
    case "dispensary":
      return h.clinic === filter;
  }
  // Clinics stay out of every hospital filter.
  if (h.clinic) return false;
  switch (filter) {
    case "all":
    case "about":
      return true;
    case "government":
      return hospitalKind(h) === "government" && !h.closed && h.phase !== "building";
    case "corporate":
    case "trust":
    case "military":
    case "midsized":
      return hospitalKind(h) === filter;
    case "projects":
      return !!(h.project || h.expanding);
    case "trusted":
      return h.lead != null;
    default:
      return h.focus.includes(filter);
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const seatCache = new Map<string, Hospital[]>();

/** Hospitals that serve a seat under a filter: in-seat first, then by priority. */
export function hospitalsForSeat(seatId: string, filter: FilterId): Hospital[] {
  const key = `${seatId}|${filter}`;
  const cached = seatCache.get(key);
  if (cached) return cached;
  const list = HOSPITALS.filter((h) => h.serves.includes(seatId) && matchesFilter(h, filter)).sort((a, b) => {
    const aOut = a.seat === seatId ? 0 : 1;
    const bOut = b.seat === seatId ? 0 : 1;
    if (aOut !== bOut) return aOut - bOut;
    if (filter === "trusted") return leadOrder(a) - leadOrder(b) || a.rank - b.rank;
    return listPriority(a) - listPriority(b) || a.rank - b.rank;
  });
  seatCache.set(key, list);
  return list;
}

const haystack = (parts: string[]) => parts.join(" ").toLowerCase();
const hospitalIndex = new Map<string, string>();

function hospitalMatchesQuery(h: Hospital, q: string): boolean {
  if (!q) return true;
  let text = hospitalIndex.get(h.id);
  if (text === undefined) {
    text = haystack([
      h.name,
      h.campus,
      h.bestFor,
      h.address,
      h.note,
      h.field ?? "",
      ...(h.facts ?? []),
      getSeat(h.seat)?.name ?? "",
      SEAT_GUIDES[h.seat]?.places ?? "",
    ]);
    hospitalIndex.set(h.id, text);
  }
  return text.includes(q);
}

export function seatMatches(seat: SeatProps, q: string, filter: FilterId): boolean {
  const served = hospitalsForSeat(seat.id, filter);
  if (filter !== "all" && filter !== "about" && served.length === 0) return false;
  if (!q) return true;
  const guide = SEAT_GUIDES[seat.id];
  const note = survey[seat.id];
  return haystack([
    seat.name,
    seat.pc,
    seat.district,
    guide?.places ?? "",
    guide?.guide ?? "",
    note?.finding ?? "",
    note?.gap ?? "",
    ...served.map((h) => `${h.name} ${h.campus}`),
  ]).includes(q);
}

/** Hospitals matching a query under a filter. Clinics surface in text search under About/All. */
export function searchHospitals(q: string, filter: FilterId): Hospital[] {
  const hasQuery = q.trim().length > 0;
  return HOSPITALS.filter((h) => {
    if (!hospitalMatchesQuery(h, q)) return false;
    if (h.clinic && hasQuery && (filter === "all" || filter === "about")) return true;
    return matchesFilter(h, filter);
  }).sort((a, b) =>
    filter === "trusted"
      ? leadOrder(a) - leadOrder(b) || a.rank - b.rank
      : listPriority(a) - listPriority(b) || a.rank - b.rank,
  );
}

/** First open, non-project hospital in a list — gets the "Start here" tag. */
export function firstRecommended(list: Hospital[]): string | undefined {
  return (list.find((h) => !h.closed && !(h.project && h.phase !== "open")) ?? list.find((h) => !h.closed))?.id;
}

const areaName = (h: Hospital) => (h.offMap ? "Outside Hyderabad" : (getSeat(h.seat)?.name ?? "Other"));

export function groupBySeat(list: Hospital[]): { label: string; hospitals: Hospital[] }[] {
  const order: string[] = [];
  const groups = new Map<string, Hospital[]>();
  const sorted = [...list].sort(
    (a, b) =>
      areaName(a).localeCompare(areaName(b)) || a.name.localeCompare(b.name) || a.campus.localeCompare(b.campus),
  );
  for (const h of sorted) {
    const label = areaName(h);
    const group = groups.get(label);
    if (group) group.push(h);
    else {
      groups.set(label, [h]);
      order.push(label);
    }
  }
  return order.map((label) => ({ label, hospitals: groups.get(label) ?? [] }));
}


export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export const mapsHref = (h: Hospital) =>
  h.offMap
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${h.name} ${h.campus}`)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export type Bounds = [[number, number], [number, number]];

function ringBounds(ring: GeoJSON.Position[]): Bounds {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x = 0, y = 0] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

export const seatBounds = (f: SeatFeature): Bounds => ringBounds(f.geometry.coordinates[0] ?? []);

export function allSeatsBounds(): Bounds {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const f of SEATS_GEOJSON.features) {
    const [[x0, y0], [x1, y1]] = seatBounds(f);
    if (x0 < minX) minX = x0;
    if (y0 < minY) minY = y0;
    if (x1 > maxX) maxX = x1;
    if (y1 > maxY) maxY = y1;
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}
