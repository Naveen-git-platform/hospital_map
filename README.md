# Hyderabad Healthcare

A map of Greater Hyderabad's 23 assembly constituencies with the hospitals and government clinics that serve each one. Rebuilt from the public site at https://hydshealthcare.auka.ai/.

**Live:** https://naveen-git-platform.github.io/hospital_map/

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

## Stack

Vite, React 19, TypeScript, Tailwind CSS v4, MapLibre GL with OpenFreeMap "Liberty" tiles, Mapterhorn terrain, and lucide-react icons.

## Layout

| Path | What it is |
| --- | --- |
| `src/data/hospitals.json` | 106 curated hospitals: tier, focus areas, "serves" list, notes, phone |
| `src/data/clinics.json` | 624 government clinics from the Telangana health-centre file |
| `src/data/constituencies.json` | GeoJSON polygons for the 23 assembly constituencies |
| `src/data/seat-guides.json` | Per-constituency neighbourhoods and guide text |
| `src/data/survey.ts` | Field-survey notes; only used by search |
| `src/lib/data.ts` | Classification, filters, sorting and search |
| `src/components/MapView.tsx` | MapLibre map: constituency fills, pins, clinic layer, legend filter |
| `src/components/Guide.tsx` | Sidebar: search, filter chips, seat and hospital views, mobile card |
| `src/App.tsx` | Layout, selection state, resizable sidebar, mobile Map/Guide toggle |

## Editing data

- Add a hospital to `hospitals.json`. `seat` is the constituency its gate sits in. `serves` lists every constituency whose guide should show it.
- Each hospital's type (corporate, trust, military, mid-size) comes from its `tier` plus the id sets in `src/lib/data.ts` (`TRUST_IDS`, `MILITARY_IDS`, `MIDSIZED_IDS`).
- A hospital with `lead` set appears under "Top hospitals". `project` or `expanding` puts it under "Projects". `offMap` lists it without a pin.
