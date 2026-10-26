// Builds src/generated/constituencies.json: Telangana's 119 assembly constituencies.
//
// Sources:
//   - DataMeet "India_AC" shapefile (CC BY 2.5 India), github.com/datameet/maps. It predates the 2014
//     state split, so Telangana seats are labelled "ANDHRA PRADESH"; under the 2008 delimitation they are
//     AC numbers 1–119 in the ten old Telangana districts.
//   - data/curated/hyderabad-constituencies.json: 23 Greater Hyderabad seats. DataMeet's city polygons put
//     well-known landmarks in the wrong seat (Charminar in Goshamahal, Punjagutta in Sanathnagar…), so
//     these replace them. DataMeet area they don't cover is attached to the nearest city seat.
//
// Usage: node scripts/data/boundaries.mjs   (expects data-raw/datameet/India_AC.*)

import fs from "node:fs";
import path from "node:path";
import mapshaper from "mapshaper";
import { haversine, ROOT, slugify, titleCase } from "./util.mjs";

const SRC = path.join(ROOT, "data-raw/datameet/India_AC.shp");
const CITY = path.join(ROOT, "data/curated/hyderabad-constituencies.json");
const OUT = path.join(ROOT, "src/generated/constituencies.json");

const TELANGANA_DISTRICTS = [
  "ADILABAD",
  "HYDERABAD",
  "KARIMNAGAR",
  "KHAMMAM",
  "MAHBUBNAGAR",
  "MEDAK",
  "NALGONDA",
  "NIZAMABAD",
  "RANGAREDDI",
  "WARANGAL",
];

/** Source spellings that need fixing, keyed by AC number. */
const NAME_FIXES = {
  17: "Nizamabad Urban",
  18: "Nizamabad Rural",
  46: "Kukatpally",
  49: "LB Nagar",
  55: "Vikarabad",
  71: "Secunderabad Cantonment",
  98: "Jangaon",
  99: "Station Ghanpur",
  107: "Wardhannapet",
};

const cleanName = (s) =>
  titleCase(
    s
      .replace(/\((SC|ST)\)?/gi, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
const cleanPc = (s) => titleCase(s.replace(/\((SC|ST)\)/gi, "").trim());
const round5 = (n) => Math.round(n * 1e5) / 1e5;

if (!fs.existsSync(SRC)) {
  console.error(`Missing ${SRC}. Download India_AC.{shp,shx,dbf,prj} from github.com/datameet/maps/assembly-constituencies.`);
  process.exit(1);
}

const city = JSON.parse(fs.readFileSync(CITY, "utf8"));
const cityAc = city.features.map((f) => f.properties.acNo);
const inTelangana = `ST_NAME === "ANDHRA PRADESH" && AC_NO >= 1 && AC_NO <= 119 && ${JSON.stringify(TELANGANA_DISTRICTS)}.includes(DIST_NAME)`;
const inputs = {};

// 1. The other 96 seats, with any overlap into the city seats cut away.
const { "rest.json": restRaw } = await mapshaper.applyCommands(
  [
    `-i "${SRC}"`,
    `-filter '${inTelangana} && !${JSON.stringify(cityAc)}.includes(AC_NO)'`,
    `-erase "${CITY}"`,
    // Inner point keeps labels inside concave shapes.
    "-each 'lx = this.innerX, ly = this.innerY'",
    "-filter-fields AC_NO,AC_NAME,PC_NAME,lx,ly",
    "-o rest.json format=geojson",
  ].join(" "),
  inputs,
);

// 2. DataMeet's city area that the curated city seats don't cover.
const { "gaps.json": gapsRaw } = await mapshaper.applyCommands(
  [
    `-i "${SRC}"`,
    `-filter '${inTelangana} && ${JSON.stringify(cityAc)}.includes(AC_NO)'`,
    "-dissolve",
    `-erase "${CITY}"`,
    "-explode",
    "-each 'cx = this.centroidX, cy = this.centroidY, km2 = this.area / 1e6'",
    "-filter 'km2 > 0.01'",
    "-o gaps.json format=geojson",
  ].join(" "),
  inputs,
);

const features = [];
const seen = new Set();
const add = (id, props, geometry) => {
  if (seen.has(id)) throw new Error(`Duplicate constituency id: ${id}`);
  seen.add(id);
  features.push({ type: "Feature", id, properties: { id, ...props }, geometry });
};

for (const f of JSON.parse(restRaw).features) {
  const p = f.properties;
  const name = NAME_FIXES[p.AC_NO] ?? cleanName(p.AC_NAME);
  add(
    slugify(name),
    { name, acNo: p.AC_NO, pc: cleanPc(p.PC_NAME), lng: round5(p.lx), lat: round5(p.ly) },
    f.geometry,
  );
}

// City seats, each gaining the gap pieces closest to it.
const cityPolys = new Map(city.features.map((f) => [f.id, [f.geometry.coordinates]]));
const nearestCitySeat = (lng, lat) => {
  let best = null;
  let bestD = Infinity;
  for (const f of city.features)
    for (const [x, y] of f.geometry.coordinates[0]) {
      const d = haversine(lat, lng, y, x);
      if (d < bestD) {
        bestD = d;
        best = f.id;
      }
    }
  return best;
};
const gaps = JSON.parse(gapsRaw).features;
let gapKm2 = 0;
for (const g of gaps) {
  const seat = nearestCitySeat(g.properties.cx, g.properties.cy);
  const polys = g.geometry.type === "Polygon" ? [g.geometry.coordinates] : g.geometry.coordinates;
  cityPolys.get(seat).push(...polys);
  gapKm2 += g.properties.km2;
}
for (const f of city.features) {
  const { name, acNo, pc, lng, lat } = f.properties;
  const polys = cityPolys.get(f.id);
  add(f.id, { name, acNo, pc, lng, lat }, polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys });
}

// 3. Simplify everything together so shared edges stay seamless.
const { "out.json": outRaw } = await mapshaper.applyCommands(
  "-i combined.json -simplify 40% keep-shapes -o out.json format=geojson precision=0.00001",
  { "combined.json": JSON.stringify({ type: "FeatureCollection", features }) },
);
const out = JSON.parse(outRaw);
out.features = out.features
  .map((f) => ({ type: "Feature", id: f.properties.id, properties: f.properties, geometry: f.geometry }))
  .sort((a, b) => a.properties.acNo - b.properties.acNo);

if (out.features.length !== 119) throw new Error(`Expected 119 constituencies, got ${out.features.length}`);
const pcs = new Set(out.features.map((f) => f.properties.pc));
if (pcs.size !== 17) throw new Error(`Expected 17 Lok Sabha seats, got ${pcs.size}: ${[...pcs].join(", ")}`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ type: "FeatureCollection", features: out.features }));
console.log(
  `constituencies: ${out.features.length} seats, ${pcs.size} Lok Sabha seats, ${gaps.length} gap pieces (${gapKm2.toFixed(0)} km²) merged into city seats, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`,
);
