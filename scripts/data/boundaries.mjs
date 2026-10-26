// Builds src/generated/constituencies.json: Telangana's 119 assembly constituencies.
//
// Source: DataMeet "India_AC" shapefile (CC BY 2.5 India), github.com/datameet/maps.
// It predates the 2014 state split, so Telangana seats are labelled "ANDHRA PRADESH";
// under the 2008 delimitation they are AC numbers 1–119 in the ten old Telangana districts.
//
// Usage: node scripts/data/boundaries.mjs   (expects data-raw/datameet/India_AC.*)

import fs from "node:fs";
import path from "node:path";
import mapshaper from "mapshaper";
import { ROOT, slugify, titleCase } from "./util.mjs";

const SRC = path.join(ROOT, "data-raw/datameet/India_AC.shp");
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

const cleanPc = (s) =>
  titleCase(
    s
      .replace(/\((SC|ST)\)/gi, "")
      .trim(),
  );

if (!fs.existsSync(SRC)) {
  console.error(`Missing ${SRC}. Download India_AC.{shp,shx,dbf,prj} from github.com/datameet/maps/assembly-constituencies.`);
  process.exit(1);
}

const districts = JSON.stringify(TELANGANA_DISTRICTS);
const { "out.json": raw } = await mapshaper.applyCommands(
  [
    `-i "${SRC}"`,
    `-filter 'ST_NAME === "ANDHRA PRADESH" && AC_NO >= 1 && AC_NO <= 119 && ${districts}.includes(DIST_NAME)'`,
    // Inner point keeps labels inside concave shapes; computed before simplifying.
    "-each 'lx = this.innerX, ly = this.innerY'",
    "-simplify 15% keep-shapes",
    "-filter-fields AC_NO,AC_NAME,PC_NAME,lx,ly",
    "-o out.json format=geojson precision=0.00001",
  ].join(" "),
);

const fc = JSON.parse(raw);
const seen = new Set();
fc.features = fc.features
  .map((f) => {
    const p = f.properties;
    const name = NAME_FIXES[p.AC_NO] ?? cleanName(p.AC_NAME);
    const id = slugify(name);
    if (seen.has(id)) throw new Error(`Duplicate constituency id: ${id}`);
    seen.add(id);
    return {
      type: "Feature",
      id,
      properties: {
        id,
        name,
        acNo: p.AC_NO,
        pc: cleanPc(p.PC_NAME),
        lng: Math.round(p.lx * 1e5) / 1e5,
        lat: Math.round(p.ly * 1e5) / 1e5,
      },
      geometry: f.geometry,
    };
  })
  .sort((a, b) => a.properties.acNo - b.properties.acNo);

if (fc.features.length !== 119) throw new Error(`Expected 119 constituencies, got ${fc.features.length}`);
const pcs = new Set(fc.features.map((f) => f.properties.pc));
if (pcs.size !== 17) throw new Error(`Expected 17 Lok Sabha seats, got ${pcs.size}: ${[...pcs].join(", ")}`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ type: "FeatureCollection", features: fc.features }));
console.log(`constituencies: ${fc.features.length} seats, ${pcs.size} Lok Sabha seats, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
