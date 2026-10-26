// Downloads health facilities in Telangana from OpenStreetMap (ODbL) via Overpass.
// Writes data-raw/osm.json (raw Overpass response). Re-run to refresh.
//
// Usage: node scripts/data/osm.mjs

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./util.mjs";

const OUT = path.join(ROOT, "data-raw/osm.json");
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

const QUERY = `
[out:json][timeout:240];
// ISO code changed from IN-TG to IN-TS in 2023; match either, or the English name.
(
  area["ISO3166-2"~"^IN-T[GS]$"]["admin_level"="4"];
  area["name:en"="Telangana"]["admin_level"="4"];
)->.ts;
(
  nwr["amenity"~"^(hospital|clinic|doctors)$"](area.ts);
  nwr["healthcare"~"^(hospital|clinic|centre|doctor)$"](area.ts);
);
out center tags;
`;

let lastError;
for (const url of ENDPOINTS) {
  try {
    console.log(`Querying ${url} …`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "CareMap-Telangana data build" },
      body: new URLSearchParams({ data: QUERY }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const json = await res.json();
    if (!json.elements?.length) throw new Error(`empty result${json.remark ? `: ${json.remark}` : ""}`);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(json));
    console.log(`osm: ${json.elements.length} elements → ${path.relative(ROOT, OUT)}`);
    process.exit(0);
  } catch (e) {
    lastError = e;
    console.warn(`  failed: ${e.message}`);
  }
}
console.error("All Overpass endpoints failed:", lastError?.message);
process.exit(1);
