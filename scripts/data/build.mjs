// Builds src/generated/facilities.json and src/generated/meta.json.
//
// Inputs (run boundaries.mjs and osm.mjs first):
//   src/generated/constituencies.json        119 assembly constituencies
//   data-raw/osm.json                      OpenStreetMap health facilities (ODbL)
//   data/curated/hospitals.json            106 hand-curated Hyderabad hospitals
//   data/curated/hyderabad-clinics.json    Hyderabad rows of the Telangana health-centre file
//   data-raw/telangana-health-centres.csv  optional: the full state health-centre file
//
// Usage: node scripts/data/build.mjs [--check]

import fs from "node:fs";
import path from "node:path";
import { geometryBbox, haversine, pointInGeometry, ROOT } from "./util.mjs";

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const CHECK = process.argv.includes("--check");

// ---------------------------------------------------------------------------
// Constituency lookup
// ---------------------------------------------------------------------------

const seats = read("src/generated/constituencies.json").features.map((f) => ({
  id: f.id,
  name: f.properties.name,
  geom: f.geometry,
  bbox: geometryBbox(f.geometry),
}));

function seatAt(lng, lat) {
  for (const s of seats) {
    const [x0, y0, x1, y1] = s.bbox;
    if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue;
    if (pointInGeometry(lng, lat, s.geom)) return s.id;
  }
  return null;
}

/** Fallback for points in slivers lost to boundary simplification: nearest vertex within 3 km. */
function nearestSeat(lng, lat) {
  let best = null;
  let bestD = 3000;
  for (const s of seats) {
    const [x0, y0, x1, y1] = s.bbox;
    if (lng < x0 - 0.05 || lng > x1 + 0.05 || lat < y0 - 0.05 || lat > y1 + 0.05) continue;
    const polys = s.geom.type === "Polygon" ? [s.geom.coordinates] : s.geom.coordinates;
    for (const rings of polys)
      for (const [x, y] of rings[0]) {
        const d = haversine(lat, lng, y, x);
        if (d < bestD) {
          bestD = d;
          best = s.id;
        }
      }
  }
  return best;
}

const locate = (lng, lat) => seatAt(lng, lat) ?? nearestSeat(lng, lat);
const seatIds = new Set(seats.map((s) => s.id));

// ---------------------------------------------------------------------------
// Name matching for de-duplication
// ---------------------------------------------------------------------------

const STOP = new Set(
  "hospital hospitals clinic clinics centre center health the govt government urban primary multi speciality specialty super pvt ltd private limited and of dr care medical a & in at".split(
    " ",
  ),
);
const tokens = (name) =>
  new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );

function sameName(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return a.trim().toLowerCase() === b.trim().toLowerCase();
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size) >= 0.5;
}

/** Grid index so "anything within N metres" checks stay fast for thousands of points. */
function makeGrid(items, cell = 0.01) {
  const grid = new Map();
  const key = (lng, lat) => `${Math.floor(lng / cell)}:${Math.floor(lat / cell)}`;
  for (const it of items) {
    const k = key(it.lng, it.lat);
    (grid.get(k) ?? grid.set(k, []).get(k)).push(it);
  }
  return (lng, lat) => {
    const cx = Math.floor(lng / cell);
    const cy = Math.floor(lat / cell);
    const out = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(grid.get(`${cx + dx}:${cy + dy}`) ?? []));
    return out;
  };
}

const findMatch = (near, f, metres) =>
  near(f.lng, f.lat).find((o) => o !== f && haversine(f.lat, f.lng, o.lat, o.lng) <= metres && sameName(o.name, f.name));

// ---------------------------------------------------------------------------
// OpenStreetMap → facility
// ---------------------------------------------------------------------------

const CORPORATE =
  /\b(apollo|yashoda|kims|care hospitals?|continental|aig|asian institute of gastro|medicover|sunshine|rainbow|ankura|star hospital|aster|gleneagles|global hospital|manipal|max cure|maxcure|fernandez|omega|american oncology|virinchi|citizens|renova|lotus|cloudnine|kamineni|svs|malla reddy|mallareddy|vijaya|tx hospital|pace hospital|sri sri holistic|lv prasad|basavatarakam|krishna institute|ozone|prasad hospital|remedy|olive|century|aware|image hospital|landmark|arete|hcg|narayana)\b/i;
const GOVT_NAME =
  /\b(govt|government|area hospital|district hospital|teaching hospital|phc|chc|uphc|community health|primary health|urban health|basti|basthi|dawakhana|esi|esic|osmania|gandhi hospital|niloufer|mch|civil hospital|tims)\b/i;
/** Word stems (no trailing boundary): "Sub Centre", "Ayurvedic", "Homoeopathy"… */
const GOVT_STEM = /\b(sub.?cent|dispensar|ayush|unani|ayurved|homoe|homeo)/i;
/** Placeholder names that identify nothing. */
const GENERIC_NAME = /^(doctors?|clinic|hospital|dispensary|medical( store)?|pharmacy|health ?cent(re|er))$/i;
const TRUST_NAME = /\b(trust|mission|charitable|foundation|society|ngo|seva|church|christian|ramakrishna|sathya sai|sai baba)\b/i;
const MILITARY_NAME = /\b(military|army|air force|naval|command hospital|cantonment general|ordnance|bison)\b/i;

function ownership(tags, name) {
  // An explicit operator:type wins; name patterns only fill in when it's missing.
  const ot = (tags["operator:type"] ?? "").toLowerCase();
  if (/military/.test(ot)) return "military";
  if (/government|public/.test(ot)) return "government";
  if (/charit|ngo|religious|community|non_profit/.test(ot)) return "charitable";
  if (/private|business/.test(ot)) return "private";
  if (MILITARY_NAME.test(name)) return "military";
  if (GOVT_NAME.test(name) || GOVT_STEM.test(name)) return "government";
  if (TRUST_NAME.test(name)) return "charitable";
  return "private";
}

function clinicKind(tags, name, own) {
  const n = name.toLowerCase();
  if (/basti|basthi|dawakhana|wellness|\bhwc\b|\buhwc\b|palle dawakhana/.test(n)) return "wellness";
  if (/community health|\bchc\b/.test(n)) return "community";
  if (/primary health|\bphc\b|\buphc\b|urban health|health post/.test(n)) return "primary";
  if (/sub.?cent|\bsc\b|health sub/.test(n)) return "subcentre";
  if (/dispensar|ayush|ayurved|unani|homoe|homeo|siddha|naturopath|yoga/.test(n)) return "dispensary";
  if (tags.healthcare === "centre" && own === "government") return "primary";
  return own === "government" ? "primary" : "private";
}

const SPECIALITY_FOCUS = [
  [/cardio|heart|cardiac/, "heart"],
  [/onco|cancer/, "cancer"],
  [/gyn|obstet|matern|paediat|pediat|neonat|child|women|mother|fertility/, "women-child"],
  [/emergency|trauma|casualty/, "emergency"],
  [/neuro/, "neuro"],
  [/gastro/, "gastro"],
];

function focusOf(tags, name) {
  const text = `${tags["healthcare:speciality"] ?? ""} ${name}`.toLowerCase();
  const focus = new Set();
  for (const [re, f] of SPECIALITY_FOCUS) if (re.test(text)) focus.add(f);
  if (tags.emergency === "yes") focus.add("emergency");
  return [...focus];
}

const firstPhone = (tags) => (tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? "").split(/[;,]/)[0].trim() || undefined;

function addressOf(tags) {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:suburb"] ?? tags["addr:neighbourhood"],
    tags["addr:city"] ?? tags["addr:place"] ?? tags["addr:district"],
    tags["addr:postcode"],
  ].filter(Boolean);
  return parts.join(", ");
}

const SPECIALITY_LABELS = {
  heart: "Heart",
  cancer: "Cancer",
  "women-child": "Women & child",
  neuro: "Neuro",
  gastro: "Gastro",
};

function fromOsm(el) {
  const tags = el.tags ?? {};
  const name = (tags.name ?? tags["name:en"] ?? "").trim();
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!name || GENERIC_NAME.test(name) || lat == null || lng == null) return null;
  if (tags.disused || tags.abandoned || /disused|abandoned/.test(tags.amenity ?? "")) return null;

  const own = ownership(tags, name);
  const isHospital =
    (tags.amenity === "hospital" || tags.healthcare === "hospital") && !/\b(phc|uphc|primary health|sub.?cent|basti|dawakhana)\b/i.test(name);
  const clinic = isHospital ? undefined : clinicKind(tags, name, own);
  // A "community health centre" tagged as a hospital is still a health centre.
  const finalClinic = isHospital && /community health|\bchc\b/i.test(name) ? "community" : clinic;
  const focus = focusOf(tags, name);
  const beds = Number.parseInt(tags.beds ?? "", 10) || undefined;
  const specialities = focus.filter((f) => f !== "emergency").map((f) => SPECIALITY_LABELS[f]);

  const kindLabel = finalClinic
    ? own === "government"
      ? "Government health centre"
      : "Private clinic"
    : own === "government"
      ? "Government hospital"
      : own === "charitable"
        ? "Trust hospital"
        : own === "military"
          ? "Military hospital"
          : CORPORATE.test(name)
            ? "Corporate hospital"
            : "Private hospital";

  return {
    id: `osm-${el.type[0]}${el.id}`,
    name,
    campus: tags["addr:suburb"] ?? tags["addr:city"] ?? tags["addr:place"] ?? "",
    tier: own === "government" ? "public" : "specialty",
    focus,
    // The kind is already shown as the status label; only specialities add information.
    bestFor: specialities.length ? `${kindLabel} · ${specialities.join(", ")}` : "",
    hasOwnerTag: tags["operator:type"] ? true : undefined,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    phone: firstPhone(tags),
    address: addressOf(tags),
    beds,
    own,
    corporate: !finalClinic && own === "private" && CORPORATE.test(name) ? true : undefined,
    clinic: finalClinic,
    src: "osm",
    // Richer OSM records sort first within a kind.
    rank: 2000 - Math.min(beds ?? 0, 999) - (tags.phone ? 50 : 0) - (tags.emergency === "yes" ? 50 : 0),
  };
}

// ---------------------------------------------------------------------------
// Optional: full Telangana health-centre CSV
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  const keys = head.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

function fromGovtCsv(row, i) {
  const pick = (...names) => names.map((n) => row[n]).find((v) => v);
  const name = pick("facility_name", "name", "health_centre_name");
  const lat = Number.parseFloat(pick("latitude", "lat"));
  const lng = Number.parseFloat(pick("longitude", "long", "lng", "lon"));
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const type = pick("facility_type", "type") ?? "";
  const status = pick("operational_status", "status") ?? "";
  const clinic = clinicKind({ healthcare: "centre" }, `${name} ${type}`, "government");
  const isHospital = /district hospital|area hospital|teaching hospital|general hospital/i.test(type);
  return {
    id: `gov-${String(i + 1).padStart(5, "0")}`,
    name,
    campus: pick("locality", "landmark") ?? "",
    tier: "public",
    focus: [],
    bestFor: type || "Government health centre",
    lat,
    lng,
    address: [pick("street"), pick("locality"), pick("district")].filter(Boolean).join(", "),
    own: "government",
    clinic: isHospital ? undefined : clinic,
    closed: /non.?functional|closed/i.test(status) || undefined,
    src: "govt",
    rank: 3000 + i,
  };
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

const curated = read("data/curated/hospitals.json").map((h) => ({ ...h, src: "curated" }));
const hydClinics = read("data/curated/hyderabad-clinics.json").map((h) => ({ ...h, own: "government", src: "govt" }));
const osmRaw = read("data-raw/osm.json").elements;
const govtCsvPath = path.join(ROOT, "data-raw/telangana-health-centres.csv");
const govtCsv = fs.existsSync(govtCsvPath)
  ? parseCsv(fs.readFileSync(govtCsvPath, "utf8")).map(fromGovtCsv).filter(Boolean)
  : [];

const stats = { osmIn: osmRaw.length, osmUnnamed: 0, osmDupInternal: 0, osmDupCurated: 0, osmDupGovt: 0, govtDup: 0, outside: 0 };

// 1. OSM, de-duplicated against itself (same name within 300 m).
let osm = [];
for (const el of osmRaw) {
  const f = fromOsm(el);
  if (f) osm.push(f);
  else stats.osmUnnamed++;
}
{
  const near = makeGrid(osm);
  const drop = new Set();
  for (const f of osm) {
    if (drop.has(f)) continue;
    for (const o of near(f.lng, f.lat))
      if (o !== f && !drop.has(o) && haversine(f.lat, f.lng, o.lat, o.lng) <= 300 && sameName(o.name, f.name)) {
        // Keep the richer record; an explicit ownership tag matters most.
        const score = (x) => (x.hasOwnerTag ? 4 : 0) + (x.phone ? 2 : 0) + (x.address ? 1 : 0) + (x.beds ? 1 : 0);
        drop.add(score(o) > score(f) ? f : o);
        if (drop.has(f)) break;
      }
  }
  stats.osmDupInternal = drop.size;
  osm = osm.filter((f) => !drop.has(f));
}

// 2. Government rows: the Hyderabad file plus the optional full CSV (CSV rows already in the Hyderabad file are skipped).
let govt = [...hydClinics];
{
  const near = makeGrid(govt);
  for (const g of govtCsv) {
    if (findMatch(near, g, 150)) stats.govtDup++;
    else govt.push(g);
  }
}

// 3. Curated wins over OSM within 300 m; government wins over OSM within 150 m (OSM keeps nothing but phone).
{
  const nearCurated = makeGrid(curated);
  const nearGovt = makeGrid(govt);
  osm = osm.filter((f) => {
    const c = findMatch(nearCurated, f, 300);
    if (c) {
      stats.osmDupCurated++;
      c.phone ??= f.phone;
      return false;
    }
    const g = findMatch(nearGovt, f, 150);
    if (g) {
      stats.osmDupGovt++;
      g.phone ??= f.phone;
      return false;
    }
    return true;
  });
}

// 4. Assign constituencies.
const facilities = [];
for (const f of [...curated, ...govt, ...osm]) {
  if (f.offMap && f.lat == null) {
    facilities.push(f);
    continue;
  }
  // Curated seats were assigned by hand from the hospital's gate; keep them when they're valid.
  const keepCurated = f.src === "curated" && !f.offMap && seatIds.has(f.seat);
  const seat = keepCurated ? f.seat : locate(f.lng, f.lat);
  if (!seat) {
    if (f.src === "curated") {
      // Curated campuses outside Telangana stay listed without a marker.
      facilities.push({ ...f, offMap: true });
    } else stats.outside++;
    continue;
  }
  const serves = f.src === "curated" ? [...new Set([seat, ...f.serves])] : [seat];
  const out = { ...f, seat, serves };
  if (f.src === "curated" && !keepCurated) {
    // Listed as outside the old 23-seat city map; with the whole state it's on the map now.
    delete out.offMap;
    stats.curatedRelocated = (stats.curatedRelocated ?? 0) + 1;
  }
  out.campus ||= seats.find((s) => s.id === seat)?.name ?? "";
  facilities.push(out);
}

// Drop undefined keys to keep the file small.
const clean = facilities.map((f) =>
  Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== undefined && v !== "" && k !== "hasOwnerTag")),
);
for (const f of clean) {
  f.address ??= "";
  f.focus ??= [];
  f.bestFor ??= "";
  f.campus ??= "";
}

// ---------------------------------------------------------------------------
// Output + checks
// ---------------------------------------------------------------------------

const ids = new Set();
for (const f of clean) {
  if (ids.has(f.id)) throw new Error(`Duplicate facility id ${f.id}`);
  ids.add(f.id);
}
const missingCurated = curated.filter((c) => !ids.has(c.id));
if (missingCurated.length) throw new Error(`Curated hospitals lost: ${missingCurated.map((c) => c.id).join(", ")}`);

const count = (pred) => clean.filter(pred).length;
const meta = {
  built: new Date().toISOString().slice(0, 10),
  counts: {
    total: clean.length,
    hospitals: count((f) => !f.clinic),
    govtClinics: count((f) => f.clinic && f.clinic !== "private"),
    privateClinics: count((f) => f.clinic === "private"),
    curated: curated.length,
    constituencies: seats.length,
  },
  sources: [
    { name: "OpenStreetMap contributors", license: "ODbL 1.0", url: "https://www.openstreetmap.org/copyright" },
    { name: "Telangana health-centre file (Open Data Telangana)", license: "Government Open Data License – India", url: "https://data.telangana.gov.in/" },
    { name: "DataMeet assembly constituencies", license: "CC BY 2.5 India", url: "https://github.com/datameet/maps" },
    { name: "Hyderabad hospital notes adapted from hydshealthcare.auka.ai", url: "https://hydshealthcare.auka.ai/" },
  ],
};

fs.writeFileSync(path.join(ROOT, "src/generated/facilities.json"), JSON.stringify(clean));
fs.writeFileSync(path.join(ROOT, "src/generated/meta.json"), JSON.stringify(meta, null, 1));

const kb = (p) => `${(fs.statSync(path.join(ROOT, p)).size / 1024).toFixed(0)} KB`;
console.log(`facilities: ${clean.length} (${kb("src/generated/facilities.json")})`, meta.counts);
console.log("merge:", { ...stats, govtCsvRows: govtCsv.length });

if (CHECK) {
  const bySeat = new Map(seats.map((s) => [s.id, 0]));
  for (const f of clean) if (f.seat) bySeat.set(f.seat, bySeat.get(f.seat) + 1);
  const empty = [...bySeat].filter(([, n]) => n === 0).map(([id]) => id);
  console.log("seats with no facilities:", empty.length ? empty : "none");
  const own = {};
  for (const f of clean) own[`${f.clinic ? `clinic:${f.clinic}` : "hospital"}/${f.own ?? "curated"}`] = (own[`${f.clinic ? `clinic:${f.clinic}` : "hospital"}/${f.own ?? "curated"}`] ?? 0) + 1;
  console.log("by kind/ownership:", own);
  const top = [...bySeat].sort((a, b) => b[1] - a[1]);
  console.log("busiest seats:", top.slice(0, 5), "quietest:", top.slice(-5));
}

