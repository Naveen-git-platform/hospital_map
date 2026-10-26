import seatGuidesJson from "../data/seat-guides.json";
import { survey } from "../data/survey";
import seatsUrl from "../generated/constituencies.json?url";
import facilitiesUrl from "../generated/facilities.json?url";
import meta from "../generated/meta.json";
import type {
  FilterId,
  Hospital,
  HospitalKind,
  MarkerKind,
  SeatCollection,
  SeatFeature,
  SeatGeometry,
  SeatGuide,
  SeatProps,
} from "./types";

// ---------------------------------------------------------------------------
// Data (loaded once at startup; the bindings below are filled by loadData)
// ---------------------------------------------------------------------------

export const DATA_META = meta;
export const SEAT_GUIDES = seatGuidesJson as Record<string, SeatGuide>;

export let HOSPITALS: Hospital[] = [];
export let SEATS_GEOJSON: SeatCollection = { type: "FeatureCollection", features: [] };
/** Constituencies sorted by name. */
export let SEATS: SeatProps[] = [];
/** Lok Sabha seats, ordered north to south by their first assembly constituency number. */
export let PC_ORDER: string[] = [];

let hospitalById = new Map<string, Hospital>();
let seatById = new Map<string, SeatProps>();
let seatFeatureById = new Map<string, SeatFeature>();
/** Facilities serving each constituency. */
let servedBy = new Map<string, Hospital[]>();

export const getHospital = (id: string) => hospitalById.get(id);
export const getSeat = (id: string) => seatById.get(id);
export const getSeatFeature = (id: string): SeatFeature | undefined => seatFeatureById.get(id);

let loading: Promise<void> | null = null;

/** Fetches facilities and boundaries in parallel and builds the lookup tables. Safe to call repeatedly. */
export function loadData(): Promise<void> {
  loading ??= (async () => {
    const [facilities, seats] = await Promise.all([
      fetch(facilitiesUrl).then((r) => {
        if (!r.ok) throw new Error(`facilities ${r.status}`);
        return r.json() as Promise<Hospital[]>;
      }),
      fetch(seatsUrl).then((r) => {
        if (!r.ok) throw new Error(`constituencies ${r.status}`);
        return r.json() as Promise<SeatCollection>;
      }),
    ]);
    HOSPITALS = facilities;
    SEATS_GEOJSON = seats;
    SEATS = seats.features.map((f) => f.properties).sort((a, b) => a.name.localeCompare(b.name));
    const firstAc = new Map<string, number>();
    for (const s of SEATS) firstAc.set(s.pc, Math.min(firstAc.get(s.pc) ?? Infinity, s.acNo));
    PC_ORDER = [...firstAc.keys()].sort((a, b) => (firstAc.get(a) ?? 0) - (firstAc.get(b) ?? 0));

    hospitalById = new Map(HOSPITALS.map((h) => [h.id, h]));
    seatById = new Map(SEATS.map((s) => [s.id, s]));
    seatFeatureById = new Map(seats.features.map((f) => [f.id, f]));
    servedBy = new Map(SEATS.map((s) => [s.id, []]));
    for (const h of HOSPITALS) for (const s of h.serves ?? []) servedBy.get(s)?.push(h);
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

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
      { id: "government", label: "Government" },
      { id: "corporate", label: "Corporate" },
      { id: "midsized", label: "Private" },
      { id: "trust", label: "Trust & NGO" },
      { id: "military", label: "Military" },
      { id: "trusted", label: "Featured (Hyd)" },
      { id: "projects", label: "Upcoming" },
    ],
  },
  {
    id: "clinics",
    label: "Clinics",
    filters: [
      { id: "primary", label: "Primary" },
      { id: "wellness", label: "Wellness" },
      { id: "community", label: "Community" },
      { id: "subcentre", label: "Sub-centres" },
      { id: "dispensary", label: "Dispensaries" },
      { id: "private", label: "Private" },
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
    line: "Every hospital on the map, grouped by assembly constituency.",
  },
  government: {
    title: "Government hospitals",
    line: "State and central hospitals that treat free or at a nominal fee. Health centres and clinics are under the Clinics tab.",
  },
  corporate: {
    title: "Corporate hospitals",
    line: "Hospitals run by the large private chains: Apollo, Yashoda, KIMS, AIG, CARE, Medicover and others.",
  },
  trust: {
    title: "Trust and charitable hospitals",
    line: "Hospitals run by a trust, mission or charitable society.",
  },
  military: {
    title: "Military hospitals",
    line: "Army, air force and defence hospitals. Most are not walk-in public hospitals.",
  },
  midsized: {
    title: "Private hospitals",
    line: "Private hospitals and nursing homes outside the large corporate chains.",
  },
  community: {
    title: "Community health centres",
    line: "Government community health centres: larger than a primary centre, often with beds.",
  },
  primary: {
    title: "Primary health centres",
    line: "Government primary and urban health centres. The first stop for routine care, free of charge.",
  },
  wellness: {
    title: "Wellness clinics",
    line: "Urban health and wellness centres, including Basti and Palle Dawakhanas.",
  },
  subcentre: {
    title: "Sub-centres",
    line: "The smallest government health posts, usually staffed by a nurse or ANM.",
  },
  dispensary: {
    title: "Dispensaries",
    line: "Government Ayurveda, Homoeopathy, Unani and other AYUSH dispensaries.",
  },
  private: {
    title: "Private clinics",
    line: "Private clinics and doctors’ practices listed in OpenStreetMap.",
  },
  projects: {
    title: "Upcoming",
    line: "New hospitals and expansions still being built, including the TIMS hospitals.",
  },
  trusted: {
    title: "Featured hospitals (Hyderabad)",
    line: "Hand-picked leading hospitals in Hyderabad: KIMS, Apollo Jubilee Hills, Yashoda, NIMS and AIG.",
  },
  heart: { title: "Heart care", line: "Hospitals marked for cardiology or heart care." },
  cancer: { title: "Cancer care", line: "Hospitals marked for oncology or cancer care." },
  "women-child": { title: "Women and child", line: "Maternity, gynaecology and children’s hospitals." },
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
  if (h.clinic) return h.closed ? "closed" : h.clinic === "private" ? "pclinic" : "clinic";
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
  if (h.src === "curated" && h.tier === "public") return 2;
  if (h.lead) return 3;
  if (h.src === "curated") return 4;
  if (h.tier === "public") return 5;
  return 6;
}

const leadOrder = (h: Hospital) => h.lead ?? 99;

export function hospitalKind(h: Hospital): HospitalKind | null {
  if (h.clinic || h.id.startsWith("chc-") || h.id.startsWith("phc-")) return null;
  if (h.src === "curated") {
    if (MILITARY_IDS.has(h.id)) return "military";
    if (TRUST_IDS.has(h.id)) return "trust";
    if (h.tier === "public") return "government";
    if (MIDSIZED_IDS.has(h.id)) return "midsized";
    return "corporate";
  }
  switch (h.own) {
    case "government":
      return "government";
    case "military":
      return "military";
    case "charitable":
      return "trust";
    default:
      return h.corporate ? "corporate" : "midsized";
  }
}

const CLINIC_LABELS = {
  community: "Community health centre",
  primary: "Primary health centre",
  wellness: "Wellness clinic",
  subcentre: "Sub-centre",
  dispensary: "Dispensary",
  private: "Private clinic",
} as const;

/** Short status line, e.g. "Corporate" or "Under construction". */
export function statusLabel(h: Hospital): string {
  if (h.clinic) {
    const label = CLINIC_LABELS[h.clinic];
    return h.closed ? `${label} · not working` : label;
  }
  if (h.closed) return "Closed";
  if (h.offMap && h.phase === "building") return "Under construction · outside Telangana";
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
      return h.src === "curated" ? "Mid-size" : "Private";
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
    case "private":
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

/** Facilities that serve a seat under a filter: in-seat first, then by priority. */
export function hospitalsForSeat(seatId: string, filter: FilterId): Hospital[] {
  const key = `${seatId}|${filter}`;
  const cached = seatCache.get(key);
  if (cached) return cached;
  const list = (servedBy.get(seatId) ?? [])
    .filter((h) => matchesFilter(h, filter))
    .sort((a, b) => {
      const aOut = a.seat === seatId ? 0 : 1;
      const bOut = b.seat === seatId ? 0 : 1;
      if (aOut !== bOut) return aOut - bOut;
      if (filter === "trusted") return leadOrder(a) - leadOrder(b) || a.rank - b.rank;
      return listPriority(a) - listPriority(b) || a.rank - b.rank;
    });
  seatCache.set(key, list);
  return list;
}

/** Every facility under a filter, in list order. */
export function hospitalsForFilter(filter: FilterId): Hospital[] {
  return HOSPITALS.filter((h) => matchesFilter(h, filter)).sort((a, b) =>
    filter === "trusted"
      ? leadOrder(a) - leadOrder(b) || a.rank - b.rank
      : listPriority(a) - listPriority(b) || a.rank - b.rank,
  );
}

/** Text a constituency can be found by. */
export function seatSearchText(seat: SeatProps): string {
  const guide = SEAT_GUIDES[seat.id];
  const note = survey[seat.id];
  return [seat.name, seat.pc, guide?.places ?? "", guide?.guide ?? "", note?.finding ?? "", note?.gap ?? ""]
    .join(" ")
    .toLowerCase();
}

/** First open, non-project hospital in a list — gets the "Best bet" tag. */
export function firstRecommended(list: Hospital[]): string | undefined {
  return (list.find((h) => !h.clinic && !h.closed && !(h.project && h.phase !== "open")) ?? list.find((h) => !h.closed))
    ?.id;
}

export const areaName = (h: Hospital) => (h.offMap ? "Outside Telangana" : (getSeat(h.seat)?.name ?? "Other"));

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

export function geometryBounds(geom: SeatGeometry): Bounds {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const rings of polys)
    for (const [x = 0, y = 0] of rings[0] ?? []) {
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

export const seatBounds = (f: SeatFeature): Bounds => geometryBounds(f.geometry);

/** Telangana's bounding box; used before data has loaded. */
export const STATE_BOUNDS: Bounds = [
  [77.24, 15.84],
  [81.81, 19.91],
];

export function allSeatsBounds(): Bounds {
  if (SEATS_GEOJSON.features.length === 0) return STATE_BOUNDS;
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
