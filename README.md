# CareMap Telangana

**Live:** https://hospital-map-hyd.vercel.app/ · https://naveen-git-platform.github.io/hospital_map/

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

## Stack

Vite, React 19, TypeScript, Tailwind CSS v4, MapLibre GL with OpenFreeMap "Positron" tiles, Plus Jakarta Sans, and lucide-react icons. Deployed on Vercel (static files plus one edge function).

## How it works

- **Location-first.** On open: last saved location (if any) → approximate location from the network (`api/geo.ts`, no prompt) → precise GPS. The panel then shows the constituency the visitor is in, the nearest emergency hospital, and the nearest hospitals and clinics with distances.
- **Fast at state scale.** Facility data (~5.6k places) is a hashed, immutably cached JSON file fetched in parallel with the map. Hospitals are a clustered MapLibre layer, clinics a circle layer, search runs in a Web Worker (MiniSearch, typo-tolerant), and nearest-place lookups use a k-d tree.

## Data

| Source | Licence | Used for |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | ODbL 1.0 | Hospitals and clinics statewide |
| Telangana health-centre file (Open Data Telangana) | Govt Open Data Licence – India | Government health centres |
| [DataMeet](https://github.com/datameet/maps) assembly constituencies | CC BY 2.5 India | The 119 constituency boundaries |
| [hydshealthcare.auka.ai](https://hydshealthcare.auka.ai/) | — | Notes on 106 curated Hyderabad hospitals |

### Rebuilding the data

```sh
# 1. Boundaries: put India_AC.{shp,shx,dbf,prj} from datameet/maps/assembly-constituencies in data-raw/datameet/
node scripts/data/boundaries.mjs
# 2. OpenStreetMap facilities (Overpass API)
node scripts/data/osm.mjs
# 3. Merge, de-duplicate, assign constituencies → src/generated/
node scripts/data/build.mjs --check
```

Optional: put the full state health-centre CSV at `data-raw/telangana-health-centres.csv` and `build.mjs` merges it too.

### Editing curated hospitals

- `data/curated/hospitals.json` holds the hand-curated Hyderabad hospitals. `serves` lists the constituencies whose pages should show it; `seat` is recomputed from coordinates on every build.
- Curated types (corporate, trust, military, mid-size) come from `tier` plus the id sets in `src/lib/data.ts`. `lead` puts a hospital under "Featured (Hyd)"; `project` or `expanding` under "Upcoming".

## Layout

| Path | What it is |
| --- | --- |
| `scripts/data/` | Data pipeline: boundaries, OSM download, merge/build |
| `data/curated/` | Curated Hyderabad hospitals and Hyderabad health-centre rows |
| `src/generated/` | Pipeline output: `facilities.json`, `constituencies.json`, `meta.json` |
| `src/data/` | Hyderabad constituency guides and survey notes |
| `api/geo.ts` | Vercel Edge Function: approximate location from IP headers |
| `src/lib/data.ts` | Loading, classification, filters, sorting |
| `src/lib/geo.ts` | Point-in-constituency, distances, nearest-place index |
| `src/lib/location.ts` | Saved / approximate / GPS location |
| `src/lib/search.ts`, `src/workers/search.worker.ts` | Off-main-thread search |
| `src/lib/theme.ts` | Brand, palette, marker kinds and icons |
| `src/components/MapView.tsx` | Map: constituencies, clustered hospitals, clinics, "you are here", map key |
| `src/components/Panel.tsx` | Floating panel / bottom sheet: near you, search, tabs, area and place views |
| `src/App.tsx` | Layout, selection state, location flow |
