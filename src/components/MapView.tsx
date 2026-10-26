import { Layers, X } from "lucide-react";
import type { ExpressionSpecification, Map as MlMap, Marker, PaddingOptions } from "maplibre-gl";
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  allSeatsBounds,
  getSeatFeature,
  HOSPITALS,
  markerKind,
  matchesFilter,
  SEATS_GEOJSON,
  seatBounds,
} from "../lib/data";
import { glyphSvg, MARKER_KINDS, palette } from "../lib/theme";
import type { FilterId, Hospital, MarkerKind, ParliamentaryConstituency } from "../lib/types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

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

/** Space covered by floating UI, so the camera frames places in the visible part of the map. */
export interface MapInsets {
  left: number;
  bottom: number;
}

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
const KEY_KINDS = Object.keys(MARKER_KINDS) as MarkerKind[];

const idIn = (ids: string[]): ExpressionSpecification => ["in", ["get", "id"], ["literal", ids]];
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function createMarker(h: Hospital, onSelect: (id: string) => void): HTMLButtonElement {
  const kind = markerKind(h);
  const el = document.createElement("button");
  el.type = "button";
  el.className = `mk mk--${kind}`;
  el.style.setProperty("--mk", MARKER_KINDS[kind].color);
  el.setAttribute("aria-label", `${h.name}, ${h.campus}`);
  el.innerHTML = `<span class="mk-body"><span class="mk-tag">${escapeHtml(h.name)}</span><span class="mk-drop">${glyphSvg(kind, "mk-glyph")}</span><span class="mk-halo"></span></span>`;
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
    palette.primary,
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
  map.setPaintProperty("seats-fill", "fill-opacity", ["case", isSel, 0.22, id ? 0.08 : 0.28]);
  map.setPaintProperty("seats-line", "line-color", ["case", isSel, palette.primaryDeep, palette.surface]);
  map.setPaintProperty("seats-line", "line-width", ["case", isSel, 3, 1.6]);
}

interface Props {
  ref: Ref<MapHandle>;
  seatId: string | null;
  hospitalId: string | null;
  filter: FilterId;
  insets: MapInsets;
  onSelectSeat: (id: string) => void;
  onSelectHospital: (id: string) => void;
}

export function MapView({ ref, seatId, hospitalId, filter, insets, onSelectSeat, onSelectHospital }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  // A selected clinic gets a temporary DOM marker on top of its circle.
  const clinicPinRef = useRef<{ id: string; marker: Marker } | null>(null);
  const pinEls = useRef(new Map<string, HTMLButtonElement>());
  const tagEls = useRef(new Map<string, HTMLSpanElement>());
  const insetsRef = useRef(insets);
  const onSelectSeatRef = useRef(onSelectSeat);
  const onSelectHospitalRef = useRef(onSelectHospital);
  const arrivedRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [keyKind, setKeyKind] = useState<MarkerKind | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);

  insetsRef.current = insets;
  onSelectSeatRef.current = onSelectSeat;
  onSelectHospitalRef.current = onSelectHospital;

  const pad = (base: number): PaddingOptions => ({
    top: base + 56,
    right: base,
    bottom: base + insetsRef.current.bottom,
    left: base + insetsRef.current.left,
  });

  useImperativeHandle(ref, () => ({
    focusSeat(id) {
      const map = mapRef.current;
      const feature = getSeatFeature(id);
      if (!map || !feature) return;
      const still = reducedMotion();
      map.fitBounds(seatBounds(feature), {
        padding: pad(40),
        maxZoom: 14,
        pitch: still ? 0 : 30,
        bearing: 0,
        duration: still ? 0 : 1100,
        essential: true,
      });
    },
    focusPoint(lng, lat) {
      const map = mapRef.current;
      if (!map) return;
      const still = reducedMotion();
      const d = 0.005;
      map.stop();
      map.fitBounds(
        [
          [lng - d, lat - d],
          [lng + d, lat + d],
        ],
        { padding: pad(48), maxZoom: 16, pitch: still ? 0 : 40, bearing: 0, duration: still ? 0 : 1300, essential: true },
      );
    },
    fitAll() {
      const map = mapRef.current;
      if (!map) return;
      const still = reducedMotion();
      map.fitBounds(allSeatsBounds(), { padding: pad(24), pitch: 0, bearing: 0, duration: still ? 0 : 900, essential: true });
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
      map = new maplibre.Map({
        container: containerRef.current,
        style: STYLE_URL,
        bounds: allSeatsBounds(),
        fitBoundsOptions: { padding: pad(24) },
        maxPitch: 60,
        fadeDuration: 0,
        minZoom: 8,
        maxZoom: 17.5,
        attributionControl: false,
      });
      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-right");
      mapRef.current = map;
      const m = map;

      m.on("styleimagemissing", (e) => {
        if (!m.hasImage(e.id)) m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });

      m.on("load", () => {
        if (cancelled) return;
        loaded = true;
        setFailed(false);

        // Constituency fills sit under the basemap's labels.
        const firstLabel = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
        m.addSource("seats", { type: "geojson", data: SEATS_GEOJSON });
        m.addLayer({ id: "seats-fill", type: "fill", source: "seats", paint: { "fill-opacity": 0.28 } }, firstLabel);
        m.addLayer({ id: "seats-line", type: "line", source: "seats", paint: {} }, firstLabel);
        paintSeats(m, null);
        m.on("click", "seats-fill", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "string") onSelectSeatRef.current(id);
        });
        m.on("mouseenter", "seats-fill", () => m.getCanvas().style.setProperty("cursor", "pointer"));
        m.on("mouseleave", "seats-fill", () => m.getCanvas().style.setProperty("cursor", ""));

        for (const f of SEATS_GEOJSON.features) {
          const el = document.createElement("span");
          el.className = "area-tag";
          el.textContent = f.properties.name === "Secunderabad Cantonment" ? "Cantonment" : f.properties.name;
          new maplibre.Marker({ element: el, anchor: "center", pitchAlignment: "viewport", rotationAlignment: "viewport" })
            .setLngLat([f.properties.lng, f.properties.lat])
            .addTo(m);
          tagEls.current.set(f.id, el);
        }

        m.addSource("clinics", { type: "geojson", data: CLINICS_GEOJSON });
        for (const layer of CLINIC_LAYERS) {
          const opacity = layer === "clinics-dim" ? 0.25 : 0.95;
          m.addLayer({
            id: layer,
            type: "circle",
            source: "clinics",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 1.8, 12, 3.2, 16, 6.5],
              "circle-color": ["case", ["get", "closed"], MARKER_KINDS.closed.color, MARKER_KINDS.clinic.color],
              "circle-stroke-color": palette.surface,
              "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 15, 1.5],
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
          const el = createMarker(h, (id) => onSelectHospitalRef.current(id));
          new maplibre.Marker({ element: el, anchor: "bottom", pitchAlignment: "viewport", rotationAlignment: "viewport" })
            .setLngLat([h.lng, h.lat])
            .addTo(m);
          pinEls.current.set(h.id, el);
        }

        // Shrink markers when zoomed out; hide area tags once streets are readable.
        let band = "";
        const onZoom = () => {
          const z = m.getZoom();
          const next = z < 11 ? "far" : z > 13.6 ? "near" : "mid";
          if (next === band) return;
          band = next;
          containerRef.current?.setAttribute("data-zoom", next);
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
      tagEls.current.clear();
      clinicPinRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once; pad() reads insets through a ref.
  }, []);

  // Sync selection, filter and map-key filter onto markers, clinic layers and area tags.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("seats-fill")) return;
    paintSeats(map, seatId);

    const applyPin = (h: Hospital, el: HTMLElement) => {
      const visible = matchesFilter(h, filter) && (!keyKind || markerKind(h) === keyKind);
      const inSeat = !seatId || h.serves.includes(seatId);
      const selected = h.id === hospitalId;
      el.classList.toggle("is-off", !visible);
      el.classList.toggle("is-dim", visible && !inSeat && !selected);
      el.classList.toggle("is-selected", selected);
      // Raise the selected marker above its neighbours.
      el.parentElement?.style.setProperty("z-index", selected ? "5" : "");
      if (selected && arrivedRef.current !== hospitalId) {
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
      if (!matchesFilter(h, filter) || (keyKind && markerKind(h) !== keyKind)) continue;
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
      const el = createMarker(clinic, (id) => onSelectHospitalRef.current(id));
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
      const el = tagEls.current.get(f.id);
      el?.classList.toggle("is-dim", !!seatId && f.id !== seatId);
      el?.classList.toggle("is-selected", f.id === seatId);
    }
  }, [seatId, hospitalId, filter, keyKind, ready]);

  return (
    <div className="absolute inset-0 bg-canvas">
      <div ref={containerRef} className="map-root h-full w-full" />
      {failed && !ready ? (
        <div className="absolute inset-x-4 top-20 z-10 mx-auto max-w-sm rounded-2xl bg-surface px-4 py-3 text-sm shadow-float md:left-[440px] md:mx-0">
          The base map couldn’t load. Search and the guide still work.
        </div>
      ) : null}
      <div className="map-key">
        {keyOpen ? (
          <div className="w-64 rounded-2xl bg-surface/95 p-3 shadow-float backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold">Map key</p>
              <button
                type="button"
                onClick={() => setKeyOpen(false)}
                className="grid size-8 place-items-center rounded-full text-subtle hover:bg-canvas"
                aria-label="Close map key"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">Tap to isolate</p>
            <ul className="grid grid-cols-2 gap-1">
              {KEY_KINDS.map((kind) => {
                const meta = MARKER_KINDS[kind];
                const active = keyKind === kind;
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setKeyKind(active ? null : kind)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium ${
                        active ? "bg-primary text-white" : "hover:bg-canvas"
                      }`}
                    >
                      <span
                        className="grid size-5 shrink-0 place-items-center rounded-full text-white"
                        style={{ background: meta.color }}
                        dangerouslySetInnerHTML={{ __html: glyphSvg(kind, "size-3") }}
                      />
                      {meta.label}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 mb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">Lok Sabha seat</p>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
              {(Object.keys(palette.pc) as ParliamentaryConstituency[]).map((pc) => (
                <li key={pc} className="flex items-center gap-2 px-2">
                  <span className="size-3 shrink-0 rounded" style={{ background: palette.pc[pc] }} />
                  {pc}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setKeyOpen(true)}
            className="flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold shadow-float"
          >
            <Layers className="size-4 text-primary" />
            {keyKind ? MARKER_KINDS[keyKind].label : "Map key"}
          </button>
        )}
        {keyKind && !keyOpen ? (
          <button
            type="button"
            onClick={() => setKeyKind(null)}
            className="flex min-h-11 items-center gap-1 rounded-full bg-surface px-3 text-xs font-semibold text-primary shadow-float"
          >
            <X className="size-3.5" />
            Show all
          </button>
        ) : null}
      </div>
    </div>
  );
}
