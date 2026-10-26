# CareMap Hyderabad

**Live:** https://hospital-map-hyd.vercel.app/ · https://naveen-git-platform.github.io/hospital_map/

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

## Stack

Vite, React 19, TypeScript, Tailwind CSS v4, MapLibre GL with OpenFreeMap "Positron" tiles, Plus Jakarta Sans, and lucide-react icons.

## Layout

| Path | What it is |
| --- | --- |
| `src/data/hospitals.json` | 106 curated hospitals: tier, focus areas, "serves" list, notes, phone |
| `src/data/clinics.json` | 624 government clinics from the Telangana health-centre file |
| `src/data/constituencies.json` | GeoJSON polygons for the 23 assembly constituencies |
| `src/data/seat-guides.json` | Per-constituency neighbourhoods and guide text |
| `src/data/survey.ts` | Field-survey notes; only used by search |
| `src/lib/data.ts` | Classification, filters, sorting and search |
| `src/lib/theme.ts` | Brand name, palette and marker kinds (colour, label, icon) |
| `src/components/MapView.tsx` | MapLibre map: constituency fills and tags, teardrop markers, clinic layer, map key |
| `src/components/Panel.tsx` | Floating panel (desktop) / bottom sheet (mobile): search, tabs, area and hospital views |
| `src/App.tsx` | Layout, selection state, sheet height, map insets |

## Editing data

- Add a hospital to `hospitals.json`. `seat` is the constituency its gate sits in. `serves` lists every constituency whose guide should show it.
- Each hospital's type (corporate, trust, military, mid-size) comes from its `tier` plus the id sets in `src/lib/data.ts` (`TRUST_IDS`, `MILITARY_IDS`, `MIDSIZED_IDS`).
- A hospital with `lead` set appears under "Top hospitals". `project` or `expanding` puts it under "Projects". `offMap` lists it without a pin.
