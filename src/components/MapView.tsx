import {
  Ambulance,
  Baby,
  Building2,
  ChevronDown,
  Cross,
  Heart,
  HeartHandshake,
  Hospital as HospitalIcon,
  House,
  Leaf,
  type LucideIcon,
  Pill,
  Ribbon,
  Shield,
  Star,
  Stethoscope,
} from "lucide-react";
import type { ExpressionSpecification, Map as MlMap, Marker } from "maplibre-gl";
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  allSeatsBounds,
  getSeatFeature,
  HOSPITALS,
  legendRole,
  matchesFilter,
  pinClass,
  SEATS_GEOJSON,
  seatBounds,
} from "../lib/data";
import { palette } from "../lib/theme";
import type { FilterId, Hospital, ParliamentaryConstituency } from "../lib/types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const TERRAIN_TILES = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp";

// Load MapLibre (and its CSS) in parallel with React, not in the main chunk.
const maplibrePromise =
  typeof window === "undefined"
    ? null
    : Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]).then(([m]) => m.default);

export interface MapHandle {
  focusSeat(seatId: string): void;
  focusPoint(lng: number, lat: number): void;
  fitAll(): void;
}

interface LegendItem {
  id: string;
  label: string;
  swatch?: string;
  icon?: LucideIcon;
  test: (h: Hospital) => boolean;
}

const byFilter = (f: FilterId) => (h: Hospital) => matchesFilter(h, f);

const LEGEND: { title?: string; items: LegendItem[] }[] = [
  {
    items: [
      { id: "govt", label: "Govt", swatch: "legend-swatch pin-public", test: (h) => legendRole(h) === "govt" },
      { id: "leading", label: "Leading", swatch: "legend-swatch", test: (h) => legendRole(h) === "leading" },
      { id: "project", label: "Project", swatch: "legend-swatch pin-project", test: (h) => legendRole(h) === "project" },
      { id: "closed", label: "Closed", swatch: "legend-swatch pin-closed", test: (h) => legendRole(h) === "closed" },
    ],
  },
  {
    title: "Hospital type",
    items: [
      { id: "corporate", label: "Corporate", icon: Building2, test: byFilter("corporate") },
      { id: "trust", label: "Trust & NGO", icon: HeartHandshake, test: byFilter("trust") },
      { id: "military", label: "Military", icon: Shield, test: byFilter("military") },
      { id: "midsized", label: "Mid-size", icon: HospitalIcon, test: byFilter("midsized") },
      { id: "trusted", label: "Top hospitals", icon: Star, test: byFilter("trusted") },
    ],
  },
  {
    title: "Clinics",
    items: [
      { id: "community", label: "Health centres", icon: Stethoscope, test: byFilter("community") },
      { id: "primary", label: "Primary centres", icon: Cross, test: byFilter("primary") },
      { id: "wellness", label: "Wellness clinics", icon: Leaf, test: byFilter("wellness") },
      { id: "subcentre", label: "Sub-centres", icon: House, test: byFilter("subcentre") },
      { id: "dispensary", label: "Dispensaries", icon: Pill, test: byFilter("dispensary") },
    ],
  },
  {
    title: "Care",
    items: [
      { id: "heart", label: "Heart", icon: Heart, test: byFilter("heart") },
      { id: "cancer", label: "Cancer", icon: Ribbon, test: byFilter("cancer") },
      { id: "women-child", label: "Women & child", icon: Baby, test: byFilter("women-child") },
      { id: "emergency", label: "Emergency", icon: Ambulance, test: byFilter("emergency") },
    ],
  },
];
const LEGEND_ITEMS = LEGEND.flatMap((g) => g.items);

/** Hospitals drawn as DOM markers; clinics are drawn as a circle layer instead. */
const PINNED = HOSPITALS.filter((h) => !h.clinic && !h.offMap);
const CLINICS = HOSPITALS.filter((h) => h.clinic && !h.offMap);
const CLINIC_LAYERS = ["clinics-on", "clinics-dim"] as const;
const CLINICS_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: CLINICS.map((h) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [h.lng, h.lat] },
    properties: { id: h.id, closed: !!h.closed },
  })),
};

const idIn = (ids: string[]): ExpressionSpecification => ["in", ["get", "id"], ["literal", ids]];
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function createPin(h: Hospital, onSelect: (id: string) => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "pin-anchor";
  el.setAttribute("aria-label", `${h.name}, ${h.campus}`);
  el.innerHTML = `<span class="pin-float"><span class="pin-ring"></span><span class="${pinClass(h)}"></span><span class="pin-stem"></span></span>`;
  el.addEventListener("pointerdown", (e) => e.stopPropagation());
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(h.id);
  });
  return el;
}

function paintSeats(map: MlMap, selected: string | null) {
  const id = selected ?? "";
  const isSel: ExpressionSpecification = ["==", ["get", "id"], id];
  map.setPaintProperty("seats-fill", "fill-color", [
    "case",
    isSel,
    palette.forest,
    [
      "match",
      ["get", "pc"],
      "Secunderabad",
      palette.pc.Secunderabad,
      "Malkajgiri",
      palette.pc.Malkajgiri,
      "Chevella",
      palette.pc.Chevella,
      palette.pc.Hyderabad,
    ],
  ]);
  map.setPaintProperty("seats-fill", "fill-opacity", ["case", isSel, 0.34, id ? 0.12 : 0.38]);
  map.setPaintProperty("seats-line", "line-color", ["case", isSel, palette.forestDeep, palette.line]);
  map.setPaintProperty("seats-line", "line-width", ["case", isSel, 2.6, 1.15]);
}

interface Props {
  ref: Ref<MapHandle>;
  seatId: string | null;
  hospitalId: string | null;
  filter: FilterId;
  /** Changes when the surrounding layout changes, so the canvas can resize. */
  layoutKey: string;
  onSelectSeat: (id: string) => void;
  onSelectHospital: (id: string) => void;
}

export function MapView({ ref, seatId, hospitalId, filter, layoutKey, onSelectSeat, onSelectHospital }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  // A selected clinic gets a temporary DOM pin on top of its circle.
  const clinicPinRef = useRef<{ id: string; marker: Marker } | null>(null);
  const pinEls = useRef(new Map<string, HTMLButtonElement>());
  const labelEls = useRef(new Map<string, HTMLSpanElement>());
  const onSelectSeatRef = useRef(onSelectSeat);
  const onSelectHospitalRef = useRef(onSelectHospital);
  const arrivedRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [legendFilter, setLegendFilter] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const legendTest = legendFilter ? LEGEND_ITEMS.find((i) => i.id === legendFilter)?.test : undefined;

  onSelectSeatRef.current = onSelectSeat;
  onSelectHospitalRef.current = onSelectHospital;

  useImperativeHandle(ref, () => ({
    focusSeat(id) {
      const map = mapRef.current;
      const feature = getSeatFeature(id);
      if (!map || !feature) return;
      const still = reducedMotion();
      map.fitBounds(seatBounds(feature), {
        padding: { top: 72, right: 48, bottom: 96, left: 36 },
        maxZoom: 14.2,
        pitch: still ? 0 : 55,
        bearing: still ? map.getBearing() : -16,
        duration: still ? 0 : 1300,
        essential: true,
      });
    },
    focusPoint(lng, lat) {
      const map = mapRef.current;
      if (!map) return;
      const still = reducedMotion();
      const d = 0.004;
      map.stop();
      map.fitBounds(
        [
          [lng - d, lat - d],
          [lng + d, lat + d],
        ],
        {
          padding: { top: 72, right: 64, bottom: 120, left: 40 },
          maxZoom: 16.4,
          pitch: still ? 0 : 64,
          bearing: still ? map.getBearing() : map.getBearing() + 22,
          duration: still ? 0 : 1700,
          essential: true,
        },
      );
    },
    fitAll() {
      const map = mapRef.current;
      if (!map) return;
      const still = reducedMotion();
      map.fitBounds(allSeatsBounds(), {
        padding: 36,
        pitch: still ? 0 : 48,
        bearing: still ? 0 : -22,
        duration: still ? 0 : 1100,
        essential: true,
      });
    },
  }));

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    let map: MlMap | null = null;
    let cancelled = false;
    let loaded = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled && !loaded) setFailed(true);
    }, 12_000);

    (async () => {
      const maplibre = await (maplibrePromise ?? Promise.reject(new Error("no window")));
      if (cancelled || !containerRef.current) return;
      libRef.current = maplibre;
      const still = reducedMotion();
      map = new maplibre.Map({
        container: containerRef.current,
        style: STYLE_URL,
        bounds: allSeatsBounds(),
        fitBoundsOptions: { padding: 36, pitch: still ? 0 : 48, bearing: still ? 0 : -22 },
        maxPitch: 72,
        fadeDuration: 0,
        canvasContextAttributes: { antialias: false },
        minZoom: 8,
        maxZoom: 17.5,
        attributionControl: false,
      });
      map.addControl(new maplibre.NavigationControl({ visualizePitch: true, showCompass: true, showZoom: true }), "top-right");
      mapRef.current = map;
      const m = map;

      // The Liberty style references a few sprites it doesn't ship; stub them silently.
      m.on("styleimagemissing", (e) => {
        if (!m.hasImage(e.id)) m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });

      m.on("load", () => {
        if (cancelled) return;
        loaded = true;
        setFailed(false);
        if (m.getLayer("building-3d")) m.setLayerZoomRange("building-3d", 13, 24);
        if (m.getLayer("building")) m.setLayerZoomRange("building", 12, 13);

        // Terrain and sky are decoration; add after the first idle so they never block pins.
        m.once("idle", () => {
          if (cancelled) return;
          try {
            m.addSource("relief", {
              type: "raster-dem",
              tiles: [TERRAIN_TILES],
              tileSize: 512,
              encoding: "terrarium",
              maxzoom: 12,
            });
            m.setTerrain({ source: "relief", exaggeration: 1.25 });
            m.setSky({
              "sky-color": "#d5e2ea",
              "horizon-color": "#f4efe6",
              "fog-color": "#e4eee6",
              "sky-horizon-blend": 0.65,
              "horizon-fog-blend": 0.7,
              "fog-ground-blend": 0.12,
              "atmosphere-blend": 0.45,
            });
          } catch {
            // Terrain is optional.
          }
        });

        const beforeRoads = m.getLayer("road_area_pattern") ? "road_area_pattern" : undefined;
        m.addSource("seats", { type: "geojson", data: SEATS_GEOJSON });
        m.addLayer(
          {
            id: "seats-fill",
            type: "fill",
            source: "seats",
            paint: { "fill-color": palette.pc.Hyderabad, "fill-opacity": 0.38 },
          },
          beforeRoads,
        );
        m.addLayer(
          {
            id: "seats-line",
            type: "line",
            source: "seats",
            paint: { "line-color": palette.line, "line-width": 1.15 },
          },
          m.getLayer("building") ? "building" : beforeRoads,
        );
        paintSeats(m, null);
        m.on("click", "seats-fill", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "string") onSelectSeatRef.current(id);
        });
        m.on("mouseenter", "seats-fill", () => m.getCanvas().style.setProperty("cursor", "pointer"));
        m.on("mouseleave", "seats-fill", () => m.getCanvas().style.setProperty("cursor", ""));

        for (const f of SEATS_GEOJSON.features) {
          const el = document.createElement("span");
          el.className = "seat-label";
          el.textContent = f.properties.name === "Secunderabad Cantonment" ? "Cantt." : f.properties.name;
          new maplibre.Marker({ element: el, anchor: "center", pitchAlignment: "viewport", rotationAlignment: "viewport" })
            .setLngLat([f.properties.lng, f.properties.lat])
            .addTo(m);
          labelEls.current.set(f.id, el);
        }

        m.addSource("clinics", { type: "geojson", data: CLINICS_GEOJSON });
        for (const layer of CLINIC_LAYERS) {
          const opacity = layer === "clinics-dim" ? 0.28 : 1;
          m.addLayer({
            id: layer,
            type: "circle",
            source: "clinics",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2, 12, 3.5, 16, 6],
              "circle-color": ["case", ["get", "closed"], palette.muted, palette.forest],
              "circle-stroke-color": palette.paper,
              "circle-stroke-width": 1,
              "circle-opacity": opacity,
              "circle-stroke-opacity": opacity,
            },
          });
          m.on("click", layer, (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (typeof id === "string") onSelectHospitalRef.current(id);
          });
          m.on("mouseenter", layer, () => m.getCanvas().style.setProperty("cursor", "pointer"));
          m.on("mouseleave", layer, () => m.getCanvas().style.setProperty("cursor", ""));
        }

        for (const h of PINNED) {
          const el = createPin(h, (id) => onSelectHospitalRef.current(id));
          new maplibre.Marker({ element: el, anchor: "bottom", pitchAlignment: "viewport", rotationAlignment: "viewport" })
            .setLngLat([h.lng, h.lat])
            .addTo(m);
          pinEls.current.set(h.id, el);
        }

        // Hide seat labels once zoomed in close enough to read streets.
        let zoomed: boolean | null = null;
        const onZoom = () => {
          const next = m.getZoom() > 13.6;
          if (next === zoomed) return;
          zoomed = next;
          for (const el of labelEls.current.values()) el.classList.toggle("is-zoomed", next);
        };
        m.on("zoom", onZoom);
        onZoom();
        setReady(true);
      });

      m.on("error", (e) => {
        const message = (e as { error?: Error }).error?.message ?? "";
        if (!loaded && /style|worker|WebGL/i.test(message)) setFailed(true);
      });
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      setReady(false);
      pinEls.current.clear();
      labelEls.current.clear();
      clinicPinRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync selection, filter and legend filter onto pins, clinic layers and labels.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("seats-fill")) return;
    paintSeats(map, seatId);

    const applyPin = (h: Hospital, el: HTMLElement) => {
      const visible = matchesFilter(h, filter) && (!legendTest || legendTest(h));
      const inSeat = !seatId || h.serves.includes(seatId);
      const selected = h.id === hospitalId;
      el.classList.toggle("is-off", !visible);
      el.classList.toggle("is-dim", visible && !inSeat && !selected);
      el.classList.toggle("is-selected", selected);
      if (selected && arrivedRef.current !== hospitalId) {
        // Restart the drop animation.
        el.classList.remove("is-arriving");
        void el.offsetWidth;
        el.classList.add("is-arriving");
        arrivedRef.current = hospitalId;
      }
      if (!selected) el.classList.remove("is-arriving");
    };
    for (const h of PINNED) {
      const el = pinEls.current.get(h.id);
      if (el) applyPin(h, el);
    }

    const on: string[] = [];
    const dim: string[] = [];
    for (const h of CLINICS) {
      if (!matchesFilter(h, filter) || (legendTest && !legendTest(h))) continue;
      (!seatId || h.serves.includes(seatId) ? on : dim).push(h.id);
    }
    map.setFilter("clinics-on", idIn(on));
    map.setFilter("clinics-dim", idIn(dim));

    const clinic = CLINICS.find((h) => h.id === hospitalId);
    if (clinicPinRef.current && clinicPinRef.current.id !== clinic?.id) {
      clinicPinRef.current.marker.remove();
      pinEls.current.delete(clinicPinRef.current.id);
      clinicPinRef.current = null;
    }
    if (clinic && !clinicPinRef.current && libRef.current) {
      const el = createPin(clinic, (id) => onSelectHospitalRef.current(id));
      const marker = new libRef.current.Marker({
        element: el,
        anchor: "bottom",
        pitchAlignment: "viewport",
        rotationAlignment: "viewport",
      })
        .setLngLat([clinic.lng, clinic.lat])
        .addTo(map);
      clinicPinRef.current = { id: clinic.id, marker };
      pinEls.current.set(clinic.id, el);
    }
    const clinicEl = clinic ? pinEls.current.get(clinic.id) : undefined;
    if (clinic && clinicEl) applyPin(clinic, clinicEl);
    if (!hospitalId) arrivedRef.current = null;

    for (const f of SEATS_GEOJSON.features) {
      const el = labelEls.current.get(f.id);
      el?.classList.toggle("is-dim", !!seatId && f.id !== seatId);
      el?.classList.toggle("is-selected", f.id === seatId);
    }
  }, [seatId, hospitalId, filter, legendTest, ready]);

  // Resize after the mobile Map/Guide toggle changes the container size.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.resize();
    const frame = requestAnimationFrame(() => map.resize());
    return () => cancelAnimationFrame(frame);
  }, [layoutKey, ready]);

  return (
    <div className="relative h-full min-h-0 w-full bg-ink">
      <div ref={containerRef} className="h-full w-full" />
      {failed && !ready ? (
        <p className="absolute top-4 right-4 left-4 rounded-lg bg-paper px-3 py-2 text-sm text-ink">
          The street map did not load. The hospital guide still works.
        </p>
      ) : null}
      <div className="map-legend">
        <button type="button" aria-expanded={legendOpen} onClick={() => setLegendOpen(!legendOpen)} className="legend-toggle">
          <span className="truncate">
            {legendFilter ? `Showing: ${LEGEND_ITEMS.find((i) => i.id === legendFilter)?.label}` : "Filter pins"}
          </span>
          <ChevronDown className={legendOpen ? "size-4 rotate-180" : "size-4"} aria-hidden />
        </button>
        {legendFilter ? (
          <button type="button" className="legend-clear" onClick={() => setLegendFilter(null)}>
            Show all pins
          </button>
        ) : null}
        {legendOpen ? (
          <ul className="legend-panel">
            {LEGEND.map((group, i) => (
              <li key={group.title ?? i} className="legend-group">
                {group.title ? <span className="legend-title">{group.title}</span> : null}
                <ul>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-pressed={legendFilter === item.id}
                          onClick={() => {
                            setLegendFilter(legendFilter === item.id ? null : item.id);
                            setLegendOpen(false);
                          }}
                          className="legend-button"
                        >
                          {Icon ? (
                            <span className="legend-icon">
                              <Icon className="size-3" aria-hidden />
                            </span>
                          ) : (
                            <span className={item.swatch} />
                          )}
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {(Object.keys(palette.pc) as ParliamentaryConstituency[]).map((pc) => (
              <li key={pc}>
                <span className="inline-block size-3 rounded-sm" style={{ background: palette.pc[pc] }} />
                {pc}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="legend-credit">© OpenStreetMap</p>
      </div>
    </div>
  );
}
