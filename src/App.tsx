import { Ambulance, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type MapHandle, type MapInsets, MapView } from "./components/MapView";
import { Logo, Panel, type SheetState } from "./components/Panel";
import { getHospital } from "./lib/data";
import { APP_CITY, APP_NAME } from "./lib/theme";
import type { FilterId } from "./lib/types";

const DESKTOP_QUERY = "(min-width: 768px)";
/** Floating panel width (400) plus its 16px gutter. */
const PANEL_INSET = 416;
/** Visible height of the mobile sheet in its "peek" state; keep in sync with styles.css. */
const PEEK_HEIGHT = 196;

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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("about");
  const [seatId, setSeatId] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>("half");
  const [panelOpen, setPanelOpen] = useState(true);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const mapRef = useRef<MapHandle>(null);

  const insets: MapInsets = isDesktop
    ? { left: panelOpen ? PANEL_INSET : 0, bottom: 0 }
    : { left: 0, bottom: sheetHeight(sheet === "full" ? "half" : sheet) };

  /** On phones, drop the sheet to half height so the map target stays visible. */
  const revealMap = () => {
    if (!isDesktop) setSheet("half");
  };

  function changeFilter(next: FilterId) {
    setFilter(next);
    setHospitalId(null);
    setSeatId(null);
    mapRef.current?.fitAll();
  }

  function selectSeat(id: string) {
    setSeatId(id);
    setHospitalId(null);
    setPanelOpen(true);
    revealMap();
    mapRef.current?.focusSeat(id);
  }

  function selectHospital(id: string) {
    const h = getHospital(id);
    if (!h) return;
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

  function back() {
    if (hospitalId) {
      setHospitalId(null);
      if (seatId) mapRef.current?.focusSeat(seatId);
    } else {
      setSeatId(null);
      mapRef.current?.fitAll();
    }
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-canvas text-ink">
      <MapView
        ref={mapRef}
        seatId={seatId}
        hospitalId={hospitalId}
        filter={filter}
        insets={insets}
        onSelectSeat={selectSeat}
        onSelectHospital={selectHospital}
      />

      {/* Brand chip on phones (desktop shows it inside the panel). */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 z-10 flex items-center gap-2 rounded-full bg-surface py-1.5 pr-4 pl-1.5 shadow-float md:hidden">
        <Logo small />
        <span className="text-sm font-extrabold tracking-tight">
          {APP_NAME} <span className="font-medium text-subtle">{APP_CITY}</span>
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

      {panelOpen || !isDesktop ? (
        <Panel
          query={query}
          setQuery={(q) => {
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
  );
}
