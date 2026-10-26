import { Ambulance, PanelLeftOpen } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type MapHandle, type MapInsets, MapView } from "./components/MapView";
import { type LocationState, LocationProvider, type LocStatus, Logo, Panel, type SheetState } from "./components/Panel";
import { getHospital, getSeat, loadData } from "./lib/data";
import { nearest, seatAt } from "./lib/geo";
import { fetchApproxLocation, loadSavedLocation, requestPosition, saveLocation } from "./lib/location";
import { initSearch } from "./lib/search";
import { APP_NAME, APP_REGION } from "./lib/theme";
import type { FilterId, LatLng } from "./lib/types";
import { readUrl, writeUrl } from "./lib/url";

const DESKTOP_QUERY = "(min-width: 768px)";
/** Floating panel width (400) plus its 16px gutter. */
const PANEL_INSET = 416;
/** Visible height of the mobile sheet in its "peek" state; keep in sync with styles.css. */
const PEEK_HEIGHT = 196;

// Start fetching data before React renders.
const dataPromise = loadData();

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function sheetHeight(state: SheetState) {
  if (state === "peek") return PEEK_HEIGHT;
  if (state === "half") return Math.round(window.innerHeight * 0.52);
  return window.innerHeight - 72;
}

export function App() {
  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("about");
  const [seatId, setSeatId] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>("half");
  const [panelOpen, setPanelOpen] = useState(true);
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [userSeat, setUserSeat] = useState<string | null>(null);
  const [approxCity, setApproxCity] = useState<string | null>(null);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const mapRef = useRef<MapHandle>(null);
  /** Set once the visitor picks something, so a late GPS fix doesn't yank the camera away. */
  const interacted = useRef(false);

  const insets: MapInsets = isDesktop
    ? { left: panelOpen ? PANEL_INSET : 0, bottom: 0 }
    : { left: 0, bottom: sheetHeight(sheet === "full" ? "half" : sheet) };

  /** Frame the visitor and the closest hospitals around them. */
  const frameUser = useCallback((loc: LatLng) => {
    const around = nearest(loc, 4, (h) => !h.clinic && !h.closed, 25).map((n) => n.hospital);
    mapRef.current?.focusPoints([loc, ...around]);
  }, []);

  const applyFix = useCallback(
    (loc: LatLng, opts: { save: boolean; moveCamera: boolean }) => {
      const seat = seatAt(loc);
      if (!seat) {
        setLocStatus("outside");
        return;
      }
      setUserLoc(loc);
      setUserSeat(seat);
      setLocStatus("found");
      if (opts.save) saveLocation(loc);
      if (opts.moveCamera && !interacted.current) frameUser(loc);
    },
    [frameUser],
  );

  const locate = useCallback(
    (fromButton: boolean) => {
      setLocStatus((s) => (s === "found" ? s : "locating"));
      if (fromButton) interacted.current = false;
      return requestPosition(
        (loc, precise) => applyFix(loc, { save: true, moveCamera: !precise || fromButton }),
        (err) => setLocStatus((s) => (s === "found" ? s : err)),
      );
    },
    [applyFix],
  );

  /** Open whatever a shared link points at. Counts as interaction, so GPS won't move the camera away. */
  const openFromUrlRef = useRef<() => void>(() => {});
  const openFromUrl = useCallback(() => openFromUrlRef.current(), []);

  // Startup: data, then the quickest location we can get, then the exact one.
  useEffect(() => {
    let cancelled = false;
    let cancelLocate: (() => void) | undefined;
    const approx = fetchApproxLocation();
    dataPromise
      .then(async () => {
        if (cancelled) return;
        setDataReady(true);
        initSearch();
        openFromUrl();
        const saved = loadSavedLocation();
        if (saved) {
          applyFix(saved, { save: false, moveCamera: true });
        } else {
          const rough = await approx;
          if (cancelled) return;
          if (rough && seatAt(rough)) {
            setApproxCity(rough.city ?? null);
            setLocStatus("approx");
            if (!interacted.current) mapRef.current?.focusArea(rough.lng, rough.lat, 10.5);
          }
        }
        cancelLocate = locate(false);
      })
      .catch(() => {
        if (!cancelled) setDataError(true);
      });
    return () => {
      cancelled = true;
      cancelLocate?.();
    };
  }, [applyFix, locate, openFromUrl]);

  // Keep the address bar in step with what's on screen, so any view can be shared.
  useEffect(() => {
    if (dataReady) writeUrl({ ac: seatId, h: hospitalId, f: filter, q: query });
  }, [dataReady, seatId, hospitalId, filter, query]);

  /** On phones, drop the sheet to half height so the map target stays visible. */
  const revealMap = () => {
    if (!isDesktop) setSheet("half");
  };

  function changeFilter(next: FilterId) {
    interacted.current = true;
    setFilter(next);
    setHospitalId(null);
    setSeatId(null);
    if (userLoc) frameUser(userLoc);
    else mapRef.current?.fitAll();
  }

  function selectSeat(id: string) {
    interacted.current = true;
    setSeatId(id);
    setHospitalId(null);
    setPanelOpen(true);
    revealMap();
    mapRef.current?.focusSeat(id);
  }

  function selectHospital(id: string) {
    const h = getHospital(id);
    if (!h) return;
    interacted.current = true;
    setHospitalId(id);
    setPanelOpen(true);
    if (h.offMap) {
      setSeatId(null);
      if (!isDesktop) setSheet("full");
    } else {
      setSeatId(h.seat);
      revealMap();
      mapRef.current?.focusPoint(h.lng, h.lat);
    }
  }

  openFromUrlRef.current = () => {
    const init = readUrl();
    if (init.f) setFilter(init.f);
    if (init.q) setQuery(init.q);
    if (init.h && getHospital(init.h)) selectHospital(init.h);
    else if (init.ac && getSeat(init.ac)) selectSeat(init.ac);
    else return;
    interacted.current = true;
  };

  function back() {
    if (hospitalId) {
      setHospitalId(null);
      if (seatId) mapRef.current?.focusSeat(seatId);
    } else {
      setSeatId(null);
      if (userLoc) frameUser(userLoc);
      else mapRef.current?.fitAll();
    }
  }

  const location: LocationState = {
    status: locStatus,
    user: userLoc,
    seatId: userSeat,
    approxCity,
    locate: () => locate(true),
  };

  return (
    <LocationProvider value={location}>
      <main className="relative h-dvh overflow-hidden bg-canvas text-ink">
        <MapView
          ref={mapRef}
          dataReady={dataReady}
          seatId={seatId}
          hospitalId={hospitalId}
          filter={filter}
          insets={insets}
          userLoc={userLoc}
          locating={locStatus === "locating" || locStatus === "approx"}
          onLocate={() => {
            if (userLoc) frameUser(userLoc);
            locate(true);
          }}
          onSelectSeat={selectSeat}
          onSelectHospital={selectHospital}
        />

        {/* Brand chip on phones (desktop shows it inside the panel). */}
        <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 z-10 flex items-center gap-2 rounded-full bg-surface py-1.5 pr-4 pl-1.5 shadow-float md:hidden">
          <Logo small />
          <span className="text-sm font-extrabold tracking-tight">
            {APP_NAME} <span className="font-medium text-subtle">{APP_REGION}</span>
          </span>
        </div>

        <a
          href="tel:108"
          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10 flex min-h-11 items-center gap-2 rounded-full bg-emergency pr-4 pl-3 text-sm font-bold text-white shadow-float md:top-4 md:right-4"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-white" />
          </span>
          <Ambulance className="size-4" />
          <span>
            <span className="hidden sm:inline">Emergency </span>108
          </span>
        </a>

        {dataError ? (
          <div className="absolute inset-x-4 top-20 z-30 mx-auto max-w-sm rounded-2xl bg-surface px-4 py-3 text-sm shadow-float">
            Couldn’t load the hospital list. Check your connection and{" "}
            <button type="button" className="font-semibold text-primary underline" onClick={() => window.location.reload()}>
              reload
            </button>
            .
          </div>
        ) : null}

        {panelOpen || !isDesktop ? (
          <Panel
            dataReady={dataReady}
            query={query}
            setQuery={(q) => {
              interacted.current = true;
              setQuery(q);
              if (q.trim()) {
                setHospitalId(null);
                setSeatId(null);
              }
            }}
            filter={filter}
            setFilter={changeFilter}
            seatId={seatId}
            hospitalId={hospitalId}
            onSelectSeat={selectSeat}
            onSelectHospital={selectHospital}
            onBack={back}
            sheet={sheet}
            onCycleSheet={() => setSheet((s) => (s === "peek" ? "half" : s === "half" ? "full" : "peek"))}
            onSearchFocus={() => {
              if (!isDesktop) setSheet("full");
            }}
            onCollapse={() => setPanelOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="absolute top-4 left-4 z-20 flex min-h-12 items-center gap-3 rounded-full bg-surface py-1.5 pr-5 pl-1.5 shadow-float"
          >
            <Logo small />
            <span className="text-sm font-extrabold">{APP_NAME}</span>
            <PanelLeftOpen className="size-4 text-subtle" />
          </button>
        )}
      </main>
    </LocationProvider>
  );
}
