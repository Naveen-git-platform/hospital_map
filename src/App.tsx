import { Ambulance, List, Map as MapIcon } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Guide, MobileCard } from "./components/Guide";
import { type MapHandle, MapView } from "./components/MapView";
import { getHospital } from "./lib/data";
import type { FilterId } from "./lib/types";

const SIDEBAR_MIN = 280;
const SIDEBAR_MAX = 640;
const SIDEBAR_DEFAULT = 384;
const SIDEBAR_KEY = "sidebar-width";

/** Clamp the sidebar so the map always keeps at least 320px. */
function clampSidebar(width: number, containerWidth: number) {
  const max = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, containerWidth - 320));
  return Math.min(max, Math.max(SIDEBAR_MIN, Math.round(width)));
}

function saveSidebar(width: number) {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, String(width));
  } catch {
    // Storage may be unavailable (private mode); the width just won't persist.
  }
}

export function App() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("about");
  const [seatId, setSeatId] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const mapRef = useRef<MapHandle>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(SIDEBAR_KEY));
      if (saved) {
        setSidebarWidth(clampSidebar(saved, window.innerWidth));
        return;
      }
    } catch {
      // Fall through to the default.
    }
    setSidebarWidth(clampSidebar(Math.min(SIDEBAR_DEFAULT, window.innerWidth * 0.4), window.innerWidth));
  }, []);

  function resizeTo(clientX: number) {
    const el = bodyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSidebarWidth(clampSidebar(clientX - rect.left, rect.width));
  }

  function changeFilter(next: FilterId) {
    setFilter(next);
    setHospitalId(null);
    setSeatId(null);
    mapRef.current?.fitAll();
  }

  function selectSeat(id: string) {
    setSeatId(id);
    setHospitalId(null);
    mapRef.current?.focusSeat(id);
    setView("map");
  }

  function selectHospital(id: string) {
    const h = getHospital(id);
    if (!h) return;
    setHospitalId(id);
    if (h.offMap) {
      setSeatId(null);
      setView("list");
    } else {
      setSeatId(h.seat);
      mapRef.current?.focusPoint(h.lng, h.lat);
      setView("map");
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

  const mapView = view === "map";
  const toggleOn = "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-paper";
  const toggleOff = "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium";

  return (
    <main className="flex h-dvh flex-col bg-paper pb-[env(safe-area-inset-bottom)] text-ink">
      <header className="border-b border-line pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        <div className="flex items-center gap-3 px-4 py-3 [@media(max-height:500px)]:py-1.5">
          <h1 className="min-w-0 flex-1 truncate font-display text-xl leading-tight md:text-2xl [@media(max-height:500px)]:text-lg">
            Hyderabad Healthcare
          </h1>
          <a
            href="tel:108"
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-pin px-3 text-sm font-semibold text-paper [@media(max-height:500px)]:min-h-9"
          >
            <Ambulance className="size-4" />
            108
          </a>
        </div>
        <div className="mx-4 mb-3 flex rounded-lg border border-line p-1 md:hidden">
          <button type="button" aria-pressed={mapView} onClick={() => setView("map")} className={mapView ? toggleOn : toggleOff}>
            <MapIcon className="size-4" />
            Map
          </button>
          <button type="button" aria-pressed={!mapView} onClick={() => setView("list")} className={!mapView ? toggleOn : toggleOff}>
            <List className="size-4" />
            Guide
          </button>
        </div>
      </header>
      <div ref={bodyRef} className="flex min-h-0 flex-1" style={{ "--sidebar-w": `${sidebarWidth}px` } as CSSProperties}>
        <aside
          className={
            mapView
              ? "hidden min-h-0 w-full md:flex md:w-[min(var(--sidebar-w),calc(100%-20rem))] md:shrink-0 md:flex-col md:border-r md:border-line"
              : "flex min-h-0 w-full flex-col md:w-[min(var(--sidebar-w),calc(100%-20rem))] md:shrink-0 md:border-r md:border-line"
          }
        >
          <Guide
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
          />
        </aside>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize guide"
          aria-valuemin={SIDEBAR_MIN}
          aria-valuemax={SIDEBAR_MAX}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (dragging) resizeTo(e.clientX);
          }}
          onPointerUp={() => {
            setDragging(false);
            saveSidebar(sidebarWidth);
          }}
          onDoubleClick={() => {
            setSidebarWidth(SIDEBAR_DEFAULT);
            saveSidebar(SIDEBAR_DEFAULT);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const next = clampSidebar(
              sidebarWidth + (e.key === "ArrowRight" ? 24 : -24),
              bodyRef.current?.getBoundingClientRect().width ?? window.innerWidth,
            );
            setSidebarWidth(next);
            saveSidebar(next);
          }}
          className={
            dragging
              ? "relative hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-forest after:absolute after:inset-y-0 after:-inset-x-2.5 after:content-[''] md:block"
              : "relative hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-line transition-colors after:absolute after:inset-y-0 after:-inset-x-2.5 after:content-[''] hover:bg-forest focus-visible:bg-forest md:block"
          }
        />
        <section className={mapView ? "relative min-h-0 flex-1" : "relative hidden min-h-0 flex-1 md:block"}>
          <MapView
            ref={mapRef}
            seatId={seatId}
            hospitalId={hospitalId}
            filter={filter}
            layoutKey={view}
            onSelectSeat={selectSeat}
            onSelectHospital={selectHospital}
          />
          <MobileCard seatId={seatId} hospitalId={hospitalId} onOpenGuide={() => setView("list")} />
        </section>
      </div>
    </main>
  );
}
