import { Layers, LocateFixed, X } from "lucide-react";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MlMap,
  MapLayerMouseEvent,
  Marker,
  PaddingOptions,
} from "maplibre-gl";
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  allSeatsBounds,
  type Bounds,
  getHospital,
  getSeatFeature,
  HOSPITALS,
  markerKind,
  matchesFilter,
  PC_ORDER,
  SEATS,
  SEATS_GEOJSON,
  seatBounds,
  STATE_BOUNDS,
} from "../lib/data";
import { glyphSvg, MARKER_KINDS, markerImageSvg, palette, pcColor } from "../lib/theme";
import type { FilterId, Hospital, LatLng, MarkerKind } from "../lib/types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const FONT_BOLD = ["Noto Sans Bold"];

// Load MapLibre (and its CSS) in parallel with React, not in the main chunk.
const maplibrePromise =
  typeof window === "undefined"
    ? null
    : Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]).then(([m]) => m.default);

export interface MapHandle {
  focusSeat(seatId: string): void;
  focusPoint(lng: number, lat: number): void;
  /** Frame a set of points (e.g. the visitor and their nearest hospitals). */
  focusPoints(points: LatLng[]): void;
  /** Wide view of an area around a point, for an approximate location. */
  focusArea(lng: number, lat: number, zoom: number): void;
  fitAll(): void;
}

/** Space covered by floating UI, so the camera frames places in the visible part of the map. */
export interface MapInsets {
  left: number;
  bottom: number;
}

const KEY_KINDS = Object.keys(MARKER_KINDS) as MarkerKind[];
const CLINIC_KINDS = new Set<MarkerKind>(["clinic", "pclinic"]);
const CLINIC_FILTERS = new Set<FilterId>(["community", "primary", "wellness", "subcentre", "dispensary", "private"]);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type PointCollection = GeoJSON.FeatureCollection<GeoJSON.Point>;
const point = (h: Hospital, properties: GeoJSON.GeoJsonProperties): GeoJSON.Feature<GeoJSON.Point> => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [h.lng, h.lat] },
  properties,
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/** The DOM teardrop used for the one selected facility. */
function createMarker(h: Hospital, onSelect: (id: string) => void): HTMLButtonElement {
  const kind = markerKind(h);
  const el = document.createElement("button");
  el.type = "button";
  el.className = `mk mk--${kind} is-selected is-arriving`;
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

async function loadMarkerImages(map: MlMap) {
  await Promise.all(
    KEY_KINDS.map(
      (kind) =>
        new Promise<void>((resolve) => {
          const img = new Image(60, 80);
          img.onload = () => {
            if (!map.hasImage(`mk-${kind}`)) map.addImage(`mk-${kind}`, img, { pixelRatio: 2 });
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markerImageSvg(kind))}`;
        }),
    ),
  );
}

function paintSeats(map: MlMap, selected: string | null) {
  const id = selected ?? "";
  const isSel: ExpressionSpecification = ["==", ["get", "id"], id];
  const byPc = [
    "match",
    ["get", "pc"],
    ...PC_ORDER.flatMap((pc) => [pc, pcColor(pc, PC_ORDER)]),
    palette.muted,
  ] as unknown as ExpressionSpecification;
  map.setPaintProperty("seats-fill", "fill-color", ["case", isSel, palette.primary, byPc]);
  map.setPaintProperty("seats-fill", "fill-opacity", ["case", isSel, 0.2, id ? 0.07 : 0.22]);
  map.setPaintProperty("seats-line", "line-color", ["case", isSel, palette.primaryDeep, palette.surface]);
  map.setPaintProperty("seats-line", "line-width", ["case", isSel, 3, 1.2]);
  map.setPaintProperty("seat-labels", "text-color", ["case", isSel, palette.primaryDeep, palette.ink]);
}

interface Props {
  ref: Ref<MapHandle>;
  dataReady: boolean;
  seatId: string | null;
  hospitalId: string | null;
  filter: FilterId;
  insets: MapInsets;
  userLoc: LatLng | null;
  locating: boolean;
  onLocate: () => void;
  onSelectSeat: (id: string) => void;
  onSelectHospital: (id: string) => void;
}

export function MapView({
  ref,
  dataReady,
  seatId,
  hospitalId,
  filter,
  insets,
  userLoc,
  locating,
  onLocate,
  onSelectSeat,
  onSelectHospital,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const selectedRef = useRef<{ id: string; marker: Marker } | null>(null);
  const insetsRef = useRef(insets);
  const onSelectSeatRef = useRef(onSelectSeat);
  const onSelectHospitalRef = useRef(onSelectHospital);
  /** Camera move requested before the map loaded; replayed once it has. */
  const pendingCamera = useRef<((m: MlMap) => void) | null>(null);
  const styleReadyRef = useRef(false);
  const [styleReady, setStyleReady] = useState(false);
  const [layersReady, setLayersReady] = useState(false);
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

  /** Run a camera move now, or as soon as the map is ready. */
  const camera = (move: (m: MlMap) => void) => {
    const map = mapRef.current;
    if (map && styleReadyRef.current) move(map);
    else pendingCamera.current = move;
  };

  const fit = (bounds: Bounds, opts: { base: number; maxZoom: number; pitch: number; duration: number }) =>
    camera((m) => {
      const still = reducedMotion();
      m.stop();
      m.fitBounds(bounds, {
        padding: pad(opts.base),
        maxZoom: opts.maxZoom,
        pitch: still ? 0 : opts.pitch,
        bearing: 0,
        duration: still ? 0 : opts.duration,
        essential: true,
      });
    });

  useImperativeHandle(ref, () => ({
    focusSeat(id) {
      const feature = getSeatFeature(id);
      if (feature) fit(seatBounds(feature), { base: 40, maxZoom: 14, pitch: 25, duration: 1100 });
    },
    focusPoint(lng, lat) {
      const d = 0.005;
      fit(
        [
          [lng - d, lat - d],
          [lng + d, lat + d],
        ],
        { base: 48, maxZoom: 16, pitch: 40, duration: 1300 },
      );
    },
    focusPoints(points) {
      if (points.length === 0) return;
      const lngs = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      const margin = 0.004;
      fit(
        [
          [Math.min(...lngs) - margin, Math.min(...lats) - margin],
          [Math.max(...lngs) + margin, Math.max(...lats) + margin],
        ],
        { base: 48, maxZoom: 15, pitch: 0, duration: 1200 },
      );
    },
    focusArea(lng, lat, zoom) {
      camera((m) => {
        m.easeTo({ center: [lng, lat], zoom, padding: pad(24), duration: reducedMotion() ? 0 : 900, essential: true });
      });
    },
    fitAll() {
      fit(allSeatsBounds(), { base: 24, maxZoom: 9, pitch: 0, duration: 900 });
    },
  }));

  // Create the map once; it does not wait for facility data.
  useEffect(() => {
    if (!containerRef.current) return;
    let map: MlMap | null = null;
    let cancelled = false;
    let loaded = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled && !loaded) setFailed(true);
    }, 15_000);

    (async () => {
      const maplibre = await (maplibrePromise ?? Promise.reject(new Error("no window")));
      if (cancelled || !containerRef.current) return;
      libRef.current = maplibre;
      map = new maplibre.Map({
        container: containerRef.current,
        style: STYLE_URL,
        bounds: STATE_BOUNDS,
        fitBoundsOptions: { padding: pad(24) },
        maxPitch: 60,
        fadeDuration: 0,
        minZoom: 5.5,
        maxZoom: 18,
        maxBounds: [
          [74.5, 14],
          [84, 21.8],
        ],
        attributionControl: false,
      });
      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(
        new maplibre.AttributionControl({
          compact: true,
          customAttribution: "Data: OpenStreetMap contributors, Open Data Telangana, DataMeet",
        }),
        "bottom-right",
      );
      mapRef.current = map;
      const m = map;
      m.on("styleimagemissing", (e) => {
        if (!m.hasImage(e.id)) m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });
      m.on("load", async () => {
        if (cancelled) return;
        loaded = true;
        setFailed(false);
        await loadMarkerImages(m);
        if (cancelled) return;
        styleReadyRef.current = true;
        setStyleReady(true);
        pendingCamera.current?.(m);
        pendingCamera.current = null;
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
      styleReadyRef.current = false;
      setStyleReady(false);
      setLayersReady(false);
      selectedRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once; pad() reads insets through a ref.
  }, []);

  // Add data layers once both the style and the facility data are ready.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !styleReady || !dataReady || m.getSource("seats")) return;
    const empty: PointCollection = { type: "FeatureCollection", features: [] };
    const firstLabel = m.getStyle().layers.find((l) => l.type === "symbol")?.id;

    m.addSource("seats", { type: "geojson", data: SEATS_GEOJSON as unknown as GeoJSON.FeatureCollection });
    m.addLayer({ id: "seats-fill", type: "fill", source: "seats", paint: {} }, firstLabel);
    m.addLayer({ id: "seats-line", type: "line", source: "seats", paint: {} }, firstLabel);

    m.addSource("clinics", { type: "geojson", data: empty });
    m.addLayer({
      id: "clinics",
      type: "circle",
      source: "clinics",
      minzoom: 9,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.2, 12, 3.6, 16, 7],
        "circle-color": [
          "case",
          ["get", "c"],
          MARKER_KINDS.closed.color,
          ["get", "p"],
          MARKER_KINDS.pclinic.color,
          MARKER_KINDS.clinic.color,
        ],
        "circle-stroke-color": palette.surface,
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 15, 1.5],
        "circle-opacity": ["case", ["get", "dim"], 0.22, 0.95],
        "circle-stroke-opacity": ["case", ["get", "dim"], 0.22, 0.95],
      },
    });

    m.addSource("context", { type: "geojson", data: empty });
    m.addLayer({
      id: "context",
      type: "circle",
      source: "context",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 4.5],
        "circle-color": palette.outline,
        "circle-opacity": 0.35,
      },
    });

    m.addSource("hospitals", { type: "geojson", data: empty, cluster: true, clusterRadius: 42, clusterMaxZoom: 12 });
    m.addLayer({
      id: "h-clusters",
      type: "circle",
      source: "hospitals",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": palette.primary,
        "circle-opacity": 0.9,
        "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 23, 200, 28],
        "circle-stroke-color": "rgba(255,255,255,0.85)",
        "circle-stroke-width": 3,
      },
    });
    m.addLayer({
      id: "h-cluster-count",
      type: "symbol",
      source: "hospitals",
      filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT_BOLD, "text-size": 12 },
      paint: { "text-color": "#ffffff" },
    });
    m.addLayer({
      id: "h-points",
      type: "symbol",
      source: "hospitals",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ["concat", "mk-", ["get", "k"]],
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.75, 14, 1],
        "symbol-sort-key": ["get", "o"],
      },
    });

    // Constituency names as map labels (one point per seat).
    m.addSource("seat-labels", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: SEATS.map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lng, s.lat] },
          properties: { id: s.id, name: s.name },
        })),
      },
    });
    m.addLayer({
      id: "seat-labels",
      type: "symbol",
      source: "seat-labels",
      minzoom: 7.6,
      maxzoom: 13.5,
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT_BOLD,
        "text-size": ["interpolate", ["linear"], ["zoom"], 7.6, 10, 11, 12.5],
        "text-max-width": 8,
        "text-padding": 4,
      },
      paint: { "text-halo-color": "rgba(255,255,255,0.92)", "text-halo-width": 1.6 },
    });

    m.addSource("me", { type: "geojson", data: empty });
    m.addLayer({
      id: "me-halo",
      type: "circle",
      source: "me",
      paint: { "circle-radius": 20, "circle-color": palette.me, "circle-opacity": 0.16 },
    });
    m.addLayer({
      id: "me-dot",
      type: "circle",
      source: "me",
      paint: { "circle-radius": 7, "circle-color": palette.me, "circle-stroke-color": "#fff", "circle-stroke-width": 3 },
    });

    const pickId = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") onSelectHospitalRef.current(id);
    };
    m.on("click", "h-points", pickId);
    m.on("click", "clinics", pickId);
    m.on("click", "context", pickId);
    m.on("click", "h-clusters", async (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const zoom = await (m.getSource("hospitals") as GeoJSONSource).getClusterExpansionZoom(f.properties?.cluster_id);
      m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.3 });
    });
    m.on("click", "seats-fill", (e) => {
      // A click on a marker or cluster belongs to it, not to the area underneath.
      const hit = m.queryRenderedFeatures(e.point, { layers: ["h-points", "h-clusters", "clinics", "context"] });
      if (hit.length > 0) return;
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") onSelectSeatRef.current(id);
    });
    for (const layer of ["h-points", "h-clusters", "clinics", "context", "seats-fill"]) {
      m.on("mouseenter", layer, () => m.getCanvas().style.setProperty("cursor", "pointer"));
      m.on("mouseleave", layer, () => m.getCanvas().style.setProperty("cursor", ""));
    }

    setLayersReady(true);
  }, [styleReady, dataReady]);

  // Push the filtered facilities into the sources whenever the selection or filters change.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !layersReady) return;
    paintSeats(m, seatId);

    const clinicsEverywhere = CLINIC_FILTERS.has(filter) || (keyKind !== null && CLINIC_KINDS.has(keyKind));
    m.setLayerZoomRange("clinics", clinicsEverywhere ? 5 : 9, 24);

    const hospitals: GeoJSON.Feature<GeoJSON.Point>[] = [];
    const clinics: GeoJSON.Feature<GeoJSON.Point>[] = [];
    const context: GeoJSON.Feature<GeoJSON.Point>[] = [];
    for (const h of HOSPITALS) {
      if (h.offMap || h.id === hospitalId || !matchesFilter(h, filter)) continue;
      const kind = markerKind(h);
      if (keyKind && kind !== keyKind) continue;
      const inSeat = !seatId || h.serves.includes(seatId);
      if (h.clinic) clinics.push(point(h, { id: h.id, p: h.clinic === "private", c: !!h.closed, dim: !inSeat }));
      else if (inSeat) hospitals.push(point(h, { id: h.id, k: kind, o: kind === "leading" ? 0 : kind === "govt" ? 1 : 2 }));
      else context.push(point(h, { id: h.id }));
    }
    (m.getSource("hospitals") as GeoJSONSource).setData({ type: "FeatureCollection", features: hospitals });
    (m.getSource("clinics") as GeoJSONSource).setData({ type: "FeatureCollection", features: clinics });
    (m.getSource("context") as GeoJSONSource).setData({ type: "FeatureCollection", features: context });

    // The selected facility is a DOM marker so it can animate and carry a name tag.
    const selected = hospitalId ? getHospital(hospitalId) : undefined;
    if (selectedRef.current && selectedRef.current.id !== selected?.id) {
      selectedRef.current.marker.remove();
      selectedRef.current = null;
    }
    if (selected && !selected.offMap && !selectedRef.current && libRef.current) {
      const el = createMarker(selected, (id) => onSelectHospitalRef.current(id));
      const marker = new libRef.current.Marker({ element: el, anchor: "bottom" })
        .setLngLat([selected.lng, selected.lat])
        .addTo(m);
      selectedRef.current = { id: selected.id, marker };
    }
  }, [seatId, hospitalId, filter, keyKind, layersReady]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !layersReady) return;
    (m.getSource("me") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: userLoc
        ? [{ type: "Feature", geometry: { type: "Point", coordinates: [userLoc.lng, userLoc.lat] }, properties: {} }]
        : [],
    });
  }, [userLoc, layersReady]);

  return (
    <div className="absolute inset-0 bg-canvas">
      <div ref={containerRef} className="map-root h-full w-full" />
      {failed && !styleReady ? (
        <div className="absolute inset-x-4 top-20 z-10 mx-auto max-w-sm rounded-2xl bg-surface px-4 py-3 text-sm shadow-float md:left-[440px] md:mx-0">
          The base map couldn’t load. Search and the guide still work.
        </div>
      ) : null}

      <button
        type="button"
        onClick={onLocate}
        className="locate-btn grid size-11 place-items-center rounded-2xl bg-surface text-primary shadow-float"
        aria-label="Show my location"
        title="Show my location"
      >
        <LocateFixed className={`size-5 ${locating ? "animate-pulse" : ""}`} />
      </button>

      <div className="map-key">
        {keyOpen ? (
          <div className="max-h-[60vh] w-64 overflow-y-auto rounded-2xl bg-surface/95 p-3 shadow-float backdrop-blur">
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
              {PC_ORDER.map((pc) => (
                <li key={pc} className="flex items-center gap-2 px-2">
                  <span className="size-3 shrink-0 rounded" style={{ background: pcColor(pc, PC_ORDER) }} />
                  <span className="truncate">{pc}</span>
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
