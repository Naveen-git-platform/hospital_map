import {
  Ambulance,
  ArrowLeft,
  BedDouble,
  CircleCheck,
  Info,
  LocateFixed,
  MapPin,
  Navigation,
  PanelLeftClose,
  Phone,
  Search,
  Siren,
  TriangleAlert,
  X,
} from "lucide-react";
import { createContext, type ReactNode, use, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  DATA_META,
  FILTER_GROUPS,
  FILTER_INTROS,
  firstRecommended,
  getHospital,
  getSeat,
  groupBySeat,
  groupOfFilter,
  hospitalsForFilter,
  hospitalsForSeat,
  mapsHref,
  markerKind,
  matchesFilter,
  PC_ORDER,
  SEAT_GUIDES,
  SEATS,
  seatSearchText,
  statusLabel,
  telHref,
} from "../lib/data";
import { distanceKm, formatDistance, nearest } from "../lib/geo";
import { useSearch } from "../lib/search";
import { APP_NAME, APP_REGION, glyphSvg, MARKER_KINDS, pcColor } from "../lib/theme";
import type { FilterId, Hospital, LatLng, SeatProps } from "../lib/types";

export type SheetState = "peek" | "half" | "full";
export type LocStatus = "idle" | "approx" | "locating" | "found" | "denied" | "unavailable" | "outside";

export interface LocationState {
  status: LocStatus;
  /** Exact (GPS) position, when known. */
  user: LatLng | null;
  /** Constituency the visitor is in. */
  seatId: string | null;
  /** City name from the network lookup, shown while the exact fix is pending. */
  approxCity: string | null;
  locate: () => void;
}

const LocationContext = createContext<LocationState>({
  status: "idle",
  user: null,
  seatId: null,
  approxCity: null,
  locate: () => {},
});
export const LocationProvider = LocationContext.Provider;

const PAGE = 40;
const GROUP_LABEL = "px-5 pt-5 pb-2 text-[11px] font-bold tracking-[0.12em] text-subtle uppercase";

export interface PanelProps {
  dataReady: boolean;
  query: string;
  setQuery: (q: string) => void;
  filter: FilterId;
  setFilter: (f: FilterId) => void;
  seatId: string | null;
  hospitalId: string | null;
  onSelectSeat: (id: string) => void;
  onSelectHospital: (id: string) => void;
  onBack: () => void;
  sheet: SheetState;
  onCycleSheet: () => void;
  onSearchFocus: () => void;
  onCollapse: () => void;
}

export function Panel(props: PanelProps) {
  const hospital = props.hospitalId ? getHospital(props.hospitalId) : undefined;
  const seat = props.seatId ? getSeat(props.seatId) : undefined;
  const group = groupOfFilter(props.filter);
  const subFilters = FILTER_GROUPS.find((g) => g.id === group)?.filters ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);

  // Each view starts at its top, not at the previous list's scroll position.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [props.hospitalId, props.seatId, props.filter, props.query]);

  return (
    <div className="panel" data-sheet={props.sheet}>
      <button
        type="button"
        onClick={props.onCycleSheet}
        className="flex h-6 shrink-0 items-center justify-center md:hidden"
        aria-label={props.sheet === "full" ? "Collapse panel" : "Expand panel"}
      >
        <span className="h-1.5 w-10 rounded-full bg-line" />
      </button>

      <div className="hidden items-center gap-3 px-5 pt-5 md:flex">
        <Logo />
        <div className="min-w-0 flex-1">
          <p className="text-lg leading-none font-extrabold tracking-tight">{APP_NAME}</p>
          <p className="mt-1 text-xs font-medium text-subtle">{APP_REGION} hospitals & clinics</p>
        </div>
        <button
          type="button"
          onClick={props.onCollapse}
          className="grid size-10 place-items-center rounded-full text-subtle hover:bg-canvas"
          aria-label="Hide panel"
        >
          <PanelLeftClose className="size-5" />
        </button>
      </div>

      <div className="flex shrink-0 flex-col gap-3 px-4 pt-2 pb-3 md:px-5 md:pt-4">
        <label className="relative block">
          <span className="sr-only">Search hospitals and areas</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={props.query}
            onChange={(e) => props.setQuery(e.target.value)}
            onFocus={props.onSearchFocus}
            placeholder="Search hospitals, towns, specialities…"
            enterKeyHint="search"
            className="min-h-12 w-full rounded-2xl border border-transparent bg-canvas pr-11 pl-11 text-sm text-ink outline-none placeholder:text-subtle focus:border-primary focus:bg-surface"
          />
          {props.query ? (
            <button
              type="button"
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-subtle hover:bg-line/60"
              onClick={() => props.setQuery("")}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </label>

        <div role="tablist" aria-label="Browse by" className="grid grid-cols-4 gap-1 rounded-2xl bg-canvas p-1">
          {FILTER_GROUPS.map((g) => {
            const active = g.id === group;
            return (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => props.setFilter(g.filters[0].id)}
                className={`min-h-10 rounded-xl text-sm font-semibold transition-colors ${
                  active ? "bg-surface text-primary shadow-sm" : "text-subtle hover:text-ink"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>

        {subFilters.length > 1 ? (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:-mx-5 md:flex-wrap md:px-5">
            {subFilters.map((f) => {
              const active = props.filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => props.setFilter(f.id)}
                  className={`min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                    active ? "border-primary bg-primary-soft text-primary" : "border-line text-ink hover:border-subtle"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line pb-6">
        {!props.dataReady ? (
          <LoadingState />
        ) : hospital ? (
          <HospitalDetail hospital={hospital} onBack={props.onBack} />
        ) : seat ? (
          <SeatDetail seat={seat} filter={props.filter} onBack={props.onBack} onSelectHospital={props.onSelectHospital} />
        ) : (
          <Overview {...props} />
        )}
      </div>
    </div>
  );
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center bg-primary text-white ${small ? "size-8 rounded-xl" : "size-11 rounded-2xl"}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className={small ? "size-4.5" : "size-6"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" />
        <path d="M12 7v6M9 10h6" />
      </svg>
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3 px-5 pt-5" aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-canvas" />
      ))}
    </div>
  );
}

function KindBadge({ hospital, large }: { hospital: Hospital; large?: boolean }) {
  const kind = markerKind(hospital);
  return (
    <span
      className={`grid shrink-0 place-items-center text-white ${large ? "size-12 rounded-2xl" : "size-9 rounded-xl"}`}
      style={{ background: MARKER_KINDS[kind].color }}
      dangerouslySetInnerHTML={{ __html: glyphSvg(kind, large ? "size-6" : "size-4.5") }}
    />
  );
}

/** Renders a long list in pages of PAGE rows. */
function Paged<T>({ items, render }: { items: T[]; render: (item: T) => ReactNode }) {
  const [shown, setShown] = useState(PAGE);
  const rest = items.length - shown;
  return (
    <>
      {items.slice(0, shown).map(render)}
      {rest > 0 ? (
        <li className="px-3 pt-2">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE * 2)}
            className="min-h-11 w-full rounded-2xl border border-line text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            Show {Math.min(rest, PAGE * 2)} more of {rest}
          </button>
        </li>
      ) : null}
    </>
  );
}

function Overview({ query, filter, onSelectSeat, onSelectHospital }: PanelProps) {
  const q = useDeferredValue(query).trim().toLowerCase();
  if (!q && filter === "about") return <Welcome onSelectSeat={onSelectSeat} onSelectHospital={onSelectHospital} />;
  if (!q) return <FilterView filter={filter} onSelectHospital={onSelectHospital} />;
  return <SearchResults q={q} filter={filter} onSelectSeat={onSelectSeat} onSelectHospital={onSelectHospital} />;
}

function SearchResults({
  q,
  filter,
  onSelectSeat,
  onSelectHospital,
}: {
  q: string;
  filter: FilterId;
  onSelectSeat: (id: string) => void;
  onSelectHospital: (id: string) => void;
}) {
  const { ids } = useSearch(q);
  const seats = useMemo(
    () =>
      SEATS.filter(
        (s) =>
          seatSearchText(s).includes(q) &&
          (filter === "about" || filter === "all" || hospitalsForSeat(s.id, filter).length > 0),
      ),
    [q, filter],
  );
  const hospitals = useMemo(() => {
    if (!ids) return [];
    const browsing = filter === "all" || filter === "about";
    return ids
      .map(getHospital)
      .filter((h): h is Hospital => !!h && (browsing || matchesFilter(h, filter)));
  }, [ids, filter]);

  if (ids === null && seats.length === 0) return <LoadingState />;
  if (seats.length === 0 && hospitals.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <Search className="mx-auto size-8 text-line" />
        <p className="mt-3 text-sm font-semibold">No results</p>
        <p className="mt-1 text-sm text-subtle">Try a town name, “Apollo”, “PHC” or “cancer”.</p>
      </div>
    );
  }
  return (
    <div>
      {seats.length > 0 ? (
        <section>
          <h2 className={GROUP_LABEL}>
            Constituencies <span className="text-ink">· {seats.length}</span>
          </h2>
          <ul className="flex flex-col gap-2 px-3">
            {seats.map((s) => (
              <li key={s.id}>
                <SeatRow seat={s} filter={filter} onSelect={onSelectSeat} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {hospitals.length > 0 ? (
        <section>
          <h2 className={GROUP_LABEL}>
            Places <span className="text-ink">· {hospitals.length === 400 ? "400+" : hospitals.length}</span>
          </h2>
          <ul className="flex flex-col gap-1 px-2">
            <Paged
              items={hospitals}
              render={(h) => (
                <li key={h.id}>
                  <HospitalRow hospital={h} showArea onSelect={onSelectHospital} />
                </li>
              )}
            />
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SeatGroups({ seats, filter, onSelect }: { seats: SeatProps[]; filter: FilterId; onSelect: (id: string) => void }) {
  return PC_ORDER.map((pc) => {
    const inPc = seats.filter((s) => s.pc === pc);
    if (inPc.length === 0) return null;
    return (
      <section key={pc}>
        <h2 className={`${GROUP_LABEL} flex items-center gap-2`}>
          <span className="size-2.5 rounded-full" style={{ background: pcColor(pc, PC_ORDER) }} />
          {pc} Lok Sabha
        </h2>
        <ul className="flex flex-col gap-2 px-3">
          {inPc.map((s) => (
            <li key={s.id}>
              <SeatRow seat={s} filter={filter} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      </section>
    );
  });
}

function Welcome({
  onSelectSeat,
  onSelectHospital,
}: {
  onSelectSeat: (id: string) => void;
  onSelectHospital: (id: string) => void;
}) {
  const { counts } = DATA_META;
  return (
    <div>
      <NearYou onSelectSeat={onSelectSeat} onSelectHospital={onSelectHospital} />
      <section className="px-5 pt-5">
        <h2 className="text-xl leading-tight font-extrabold tracking-tight">Healthcare across {APP_REGION}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-subtle">
          Hospitals, government health centres and clinics in all {counts.constituencies} assembly constituencies.
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[
            { n: counts.hospitals, label: "hospitals" },
            { n: counts.govtClinics, label: "govt clinics" },
            { n: counts.constituencies, label: "constituencies" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-canvas px-3 py-2.5">
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-lg font-extrabold">{s.n.toLocaleString("en-IN")}</dd>
              <dd className="text-xs font-medium text-subtle">{s.label}</dd>
            </div>
          ))}
        </dl>
        <About />
      </section>
      <SeatGroups seats={SEATS} filter="about" onSelect={onSelectSeat} />
    </div>
  );
}

function About() {
  return (
    <details className="mt-3 rounded-2xl bg-canvas px-3 py-2.5 text-xs leading-relaxed text-subtle">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink">
        <Info className="size-4 shrink-0" />
        About this data · updated {DATA_META.built}
      </summary>
      <p className="mt-2">
        A directory, not a ranking of medical quality. Listings can be out of date — call ahead, and in an emergency dial{" "}
        <a href="tel:108" className="font-semibold text-emergency">
          108
        </a>
        .
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {DATA_META.sources.map((s) => (
          <li key={s.name}>
            <a href={s.url} target="_blank" rel="noreferrer" className="underline">
              {s.name}
            </a>
            {"license" in s && s.license ? ` · ${s.license}` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

function NearYou({
  onSelectSeat,
  onSelectHospital,
}: {
  onSelectSeat: (id: string) => void;
  onSelectHospital: (id: string) => void;
}) {
  const loc = use(LocationContext);
  const near = useMemo(() => {
    if (!loc.user) return null;
    const at = loc.user;
    const usable = (h: Hospital) => !h.closed && !(h.project && h.phase === "building");
    return {
      emergency:
        nearest(at, 1, (h) => !h.clinic && usable(h) && h.focus.includes("emergency"), 60)[0] ??
        nearest(at, 1, (h) => !h.clinic && usable(h) && h.tier === "public", 60)[0],
      hospitals: nearest(at, 8, (h) => !h.clinic && usable(h), 80),
      clinics: nearest(at, 5, (h) => !!h.clinic && h.clinic !== "private" && usable(h), 40),
    };
  }, [loc.user]);
  const seat = loc.seatId ? getSeat(loc.seatId) : undefined;

  if (!loc.user) {
    const message =
      loc.status === "denied"
        ? "Location is turned off. Allow it to see the nearest hospitals, or pick your constituency below."
        : loc.status === "unavailable"
          ? "Couldn’t get your location. Try again, or pick your constituency below."
          : loc.status === "outside"
            ? `You seem to be outside ${APP_REGION}. Browse by constituency below.`
            : loc.approxCity
              ? `Showing the ${loc.approxCity} area. Finding your exact location…`
              : "Finding your location…";
    const busy = loc.status === "idle" || loc.status === "approx" || loc.status === "locating";
    return (
      <section className="mx-3 mt-3 flex items-start gap-3 rounded-3xl bg-primary-soft p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-white">
          <LocateFixed className={`size-5 ${busy ? "animate-pulse" : ""}`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Hospitals near you</p>
          <p className="mt-0.5 text-sm leading-snug text-ink/75">{message}</p>
          {!busy ? (
            <button
              type="button"
              onClick={loc.locate}
              className="mt-2 min-h-10 rounded-full bg-primary px-4 text-sm font-semibold text-white"
            >
              Use my location
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="pt-3">
      <div className="mx-3 rounded-3xl bg-primary-soft p-4">
        <p className="text-xs font-bold tracking-wide text-primary uppercase">You’re in</p>
        <div className="mt-0.5 flex items-center justify-between gap-3">
          <p className="text-2xl leading-tight font-extrabold tracking-tight">{seat?.name ?? "Telangana"}</p>
          {seat ? (
            <button
              type="button"
              onClick={() => onSelectSeat(seat.id)}
              className="min-h-10 shrink-0 rounded-full bg-surface px-3.5 text-xs font-bold text-primary shadow-sm"
            >
              View area
            </button>
          ) : null}
        </div>
        {seat ? <p className="text-sm text-ink/70">{seat.pc} Lok Sabha</p> : null}

        {near?.emergency ? (
          <div className="mt-3 rounded-2xl bg-surface p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-emergency uppercase">
              <Siren className="size-4" />
              Nearest emergency · {formatDistance(near.emergency.km)}
            </p>
            <button type="button" onClick={() => onSelectHospital(near.emergency.hospital.id)} className="mt-1 block text-left">
              <span className="font-bold">{near.emergency.hospital.name}</span>
              <span className="block text-xs text-subtle">{statusLabel(near.emergency.hospital)}</span>
            </button>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {near.emergency.hospital.phone ? (
                <a
                  href={telHref(near.emergency.hospital.phone)}
                  className="flex min-h-10 items-center justify-center gap-1 rounded-xl bg-primary text-xs font-bold text-white"
                >
                  <Phone className="size-4" /> Call
                </a>
              ) : null}
              <a
                href={mapsHref(near.emergency.hospital)}
                target="_blank"
                rel="noreferrer"
                className={`flex min-h-10 items-center justify-center gap-1 rounded-xl bg-canvas text-xs font-bold ${
                  near.emergency.hospital.phone ? "" : "col-span-2"
                }`}
              >
                <Navigation className="size-4" /> Go
              </a>
              <a
                href="tel:108"
                className="flex min-h-10 items-center justify-center gap-1 rounded-xl bg-emergency text-xs font-bold text-white"
              >
                <Ambulance className="size-4" /> 108
              </a>
            </div>
          </div>
        ) : null}
      </div>

      {near && near.hospitals.length > 0 ? (
        <>
          <h3 className={GROUP_LABEL}>Nearest hospitals</h3>
          <ul className="flex flex-col gap-1 px-2">
            {near.hospitals.map(({ hospital }) => (
              <li key={hospital.id}>
                <HospitalRow hospital={hospital} showArea onSelect={onSelectHospital} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {near && near.clinics.length > 0 ? (
        <>
          <h3 className={GROUP_LABEL}>Nearest government clinics</h3>
          <ul className="flex flex-col gap-1 px-2">
            {near.clinics.map(({ hospital }) => (
              <li key={hospital.id}>
                <HospitalRow hospital={hospital} showArea onSelect={onSelectHospital} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function FilterView({ filter, onSelectHospital }: { filter: FilterId; onSelectHospital: (id: string) => void }) {
  const loc = use(LocationContext);
  const intro = FILTER_INTROS[filter as Exclude<FilterId, "about">];
  const list = useMemo(() => {
    const all = hospitalsForFilter(filter);
    // With a known location, the closest come first.
    if (!loc.user) return all;
    const at = loc.user;
    return all
      .map((h) => ({ h, d: h.offMap ? Infinity : distanceKm(at, h) }))
      .sort((a, b) => a.d - b.d)
      .map((x) => x.h);
  }, [filter, loc.user]);
  const flat = !!loc.user || filter === "trusted" || filter === "projects";
  return (
    <div>
      <section className="px-5 pt-5 pb-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl leading-tight font-extrabold tracking-tight">{intro.title}</h2>
          <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
            {list.length.toLocaleString("en-IN")}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-subtle">{intro.line}</p>
        {loc.user ? <p className="mt-1.5 text-xs font-semibold text-primary">Sorted by distance from you</p> : null}
      </section>
      {list.length === 0 ? (
        <p className="px-5 py-8 text-sm text-subtle">Nothing here yet.</p>
      ) : flat ? (
        <ul className="mt-2 flex flex-col gap-1 px-2">
          <Paged
            items={list}
            render={(h) => (
              <li key={h.id}>
                <HospitalRow hospital={h} showArea onSelect={onSelectHospital} />
              </li>
            )}
          />
        </ul>
      ) : (
        <GroupedBySeat list={list} onSelectHospital={onSelectHospital} />
      )}
    </div>
  );
}

function GroupedBySeat({ list, onSelectHospital }: { list: Hospital[]; onSelectHospital: (id: string) => void }) {
  const groups = useMemo(() => groupBySeat(list), [list]);
  const [shown, setShown] = useState(12);
  return (
    <>
      {groups.slice(0, shown).map((group) => (
        <section key={group.label}>
          <h3 className={GROUP_LABEL}>
            {group.label} <span className="text-ink">· {group.hospitals.length}</span>
          </h3>
          <ul className="flex flex-col gap-1 px-2">
            <Paged
              items={group.hospitals}
              render={(h) => (
                <li key={h.id}>
                  <HospitalRow hospital={h} onSelect={onSelectHospital} />
                </li>
              )}
            />
          </ul>
        </section>
      ))}
      {groups.length > shown ? (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => setShown((n) => n + 24)}
            className="min-h-11 w-full rounded-2xl border border-line text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            Show more constituencies ({groups.length - shown} left)
          </button>
        </div>
      ) : null}
    </>
  );
}

function SeatRow({ seat, filter, onSelect }: { seat: SeatProps; filter: FilterId; onSelect: (id: string) => void }) {
  const loc = use(LocationContext);
  const count = hospitalsForSeat(seat.id, filter).length;
  const isHome = loc.seatId === seat.id;
  return (
    <button
      type="button"
      onClick={() => onSelect(seat.id)}
      className={`group flex w-full items-center gap-3 rounded-2xl border bg-surface p-3 text-left transition hover:border-primary hover:shadow-sm ${
        isHome ? "border-primary" : "border-line"
      }`}
    >
      <span className="w-1.5 self-stretch rounded-full" style={{ background: pcColor(seat.pc, PC_ORDER) }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-bold">
          {seat.name}
          {isHome ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">You</span>
          ) : null}
        </span>
        <span className="mt-0.5 line-clamp-1 block text-xs text-subtle">
          {SEAT_GUIDES[seat.id]?.places ?? `AC ${seat.acNo} · ${seat.pc} Lok Sabha`}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-lg leading-none font-extrabold text-primary">{count}</span>
        <span className="text-[10px] font-semibold text-subtle uppercase">{count === 1 ? "hospital" : "hospitals"}</span>
      </span>
    </button>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-3 mt-3 flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-primary hover:bg-primary-soft"
    >
      <ArrowLeft className="size-4" />
      {label}
    </button>
  );
}

function SeatDetail({
  seat,
  filter,
  onBack,
  onSelectHospital,
}: {
  seat: SeatProps;
  filter: FilterId;
  onBack: () => void;
  onSelectHospital: (id: string) => void;
}) {
  const guide = SEAT_GUIDES[seat.id];
  const list = hospitalsForSeat(seat.id, filter);
  const govtClinics = (["primary", "community", "wellness", "subcentre", "dispensary"] as FilterId[]).flatMap((f) =>
    hospitalsForSeat(seat.id, f),
  );
  const showClinics = filter === "about" || filter === "all";
  const first = firstRecommended(list);
  return (
    <div>
      <BackButton label="All areas" onClick={onBack} />
      <section className="px-5 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">AC {seat.acNo}</span>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold text-ink"
            style={{ background: pcColor(seat.pc, PC_ORDER) }}
          >
            {seat.pc} Lok Sabha
          </span>
        </div>
        <h2 className="mt-3 text-3xl leading-tight font-extrabold tracking-tight">{seat.name}</h2>
        {guide?.places ? <p className="mt-1 text-sm text-subtle">{guide.places}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-primary-soft px-3 py-2.5">
            <p className="text-xl font-extrabold text-primary">{list.length}</p>
            <p className="text-xs font-medium text-primary/80">{filter === "about" ? "hospitals" : "matching places"}</p>
          </div>
          <div className="rounded-2xl bg-canvas px-3 py-2.5">
            <p className="text-xl font-extrabold">{govtClinics.length}</p>
            <p className="text-xs font-medium text-subtle">government clinics</p>
          </div>
        </div>
        {guide?.guide ? (
          <p className="mt-4 rounded-2xl border-l-4 border-primary bg-canvas px-4 py-3 text-sm leading-relaxed">{guide.guide}</p>
        ) : null}
      </section>
      <h3 className={GROUP_LABEL}>Where to go</h3>
      {list.length === 0 ? (
        <p className="px-5 py-4 text-sm text-subtle">Nothing in this area matches the current filter.</p>
      ) : (
        <ul className="flex flex-col gap-1 px-2">
          <Paged
            items={list}
            render={(h) => (
              <li key={h.id}>
                <HospitalRow hospital={h} seatId={seat.id} recommended={h.id === first} onSelect={onSelectHospital} />
              </li>
            )}
          />
        </ul>
      )}
      {showClinics && govtClinics.length > 0 ? (
        <>
          <h3 className={GROUP_LABEL}>Government clinics · {govtClinics.length}</h3>
          <ul className="flex flex-col gap-1 px-2">
            <Paged
              items={govtClinics}
              render={(h) => (
                <li key={h.id}>
                  <HospitalRow hospital={h} seatId={seat.id} onSelect={onSelectHospital} />
                </li>
              )}
            />
          </ul>
        </>
      ) : null}
    </div>
  );
}

function HospitalRow({
  hospital: h,
  seatId,
  recommended,
  showArea,
  onSelect,
}: {
  hospital: Hospital;
  seatId?: string;
  recommended?: boolean;
  showArea?: boolean;
  onSelect: (id: string) => void;
}) {
  const loc = use(LocationContext);
  const area = h.offMap ? "Outside Telangana" : (getSeat(h.seat)?.name ?? "");
  const where = showArea ? area : seatId ? (h.seat === seatId ? "" : "Nearby") : null;
  const km = loc.user && !h.offMap ? distanceKm(loc.user, h) : null;
  const sub = [statusLabel(h), h.campus && h.campus !== area ? h.campus : "", where ?? ""].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => onSelect(h.id)}
      className="flex w-full gap-3 rounded-2xl p-3 text-left transition hover:bg-canvas"
    >
      <KindBadge hospital={h} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="leading-snug font-bold">{h.name}</span>
          {km !== null ? (
            <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-[11px] font-bold text-ink/70">
              {formatDistance(km)}
            </span>
          ) : recommended ? (
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white uppercase">
              Best bet
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-subtle">{sub}</span>
        {h.bestFor && h.bestFor !== statusLabel(h) ? (
          <span className="mt-1 line-clamp-2 block text-sm text-ink/80">{h.bestFor}</span>
        ) : null}
      </span>
    </button>
  );
}

function HospitalDetail({ hospital: h, onBack }: { hospital: Hospital; onBack: () => void }) {
  const loc = use(LocationContext);
  const seat = getSeat(h.seat);
  const kind = markerKind(h);
  const color = MARKER_KINDS[kind].color;
  const km = loc.user && !h.offMap ? distanceKm(loc.user, h) : null;
  return (
    <div>
      <BackButton label={seat ? `Back to ${seat.name}` : "Back"} onClick={onBack} />
      <section className="mx-3 mt-2 rounded-3xl p-4" style={{ background: `${color}14` }}>
        <div className="flex items-center gap-3">
          <KindBadge hospital={h} large />
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide uppercase" style={{ color }}>
              {statusLabel(h)}
            </p>
            <p className="text-sm text-subtle">
              {[h.campus, km !== null ? `${formatDistance(km)} away` : ""].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <h2 className="mt-3 text-2xl leading-tight font-extrabold tracking-tight">{h.name}</h2>
        {h.bestFor && h.bestFor !== statusLabel(h) ? (
          <p className="mt-1 text-sm font-semibold text-ink/80">{h.bestFor}</p>
        ) : null}
        <div className={`mt-4 grid gap-2 ${h.phone ? "grid-cols-3" : "grid-cols-2"}`}>
          {h.phone ? <ActionLink href={telHref(h.phone)} icon={<Phone className="size-5" />} label="Call" primary /> : null}
          <ActionLink
            href={mapsHref(h)}
            external
            icon={<Navigation className="size-5" />}
            label={h.offMap ? "Find" : "Directions"}
            primary={!h.phone}
          />
          <ActionLink href="tel:108" icon={<Ambulance className="size-5" />} label="108" danger />
        </div>
      </section>

      <div className="flex flex-col gap-4 px-5 pt-5">
        {h.note ? (
          <section>
            <h3 className="text-sm font-bold">Overview</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink/85">{h.note}</p>
          </section>
        ) : null}
        {h.facts && h.facts.length > 0 ? (
          <section>
            <h3 className="text-sm font-bold">Highlights</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {h.facts.map((fact) => (
                <li key={fact} className="flex gap-2 text-sm leading-relaxed">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  {fact}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {h.caution ? (
          <p className="flex gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {h.caution}
          </p>
        ) : null}
        {h.beds ? (
          <p className="flex items-center gap-2 text-sm">
            <BedDouble className="size-4 text-primary" />
            {h.beds} beds
          </p>
        ) : null}
        <section className="rounded-2xl border border-line p-3">
          {h.address ? (
            <p className="flex gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              {h.address}
            </p>
          ) : null}
          <p className={`text-xs leading-relaxed text-subtle ${h.address ? "mt-2" : ""}`}>
            {h.offMap
              ? "Outside Telangana, so it has no marker."
              : `In ${seat?.name ?? "this area"} constituency${seat ? ` (${seat.pc} Lok Sabha)` : ""}.`}{" "}
            {h.src === "osm"
              ? "Listed in OpenStreetMap."
              : h.src === "govt"
                ? "From the Telangana health-centre file."
                : "Curated listing."}
          </p>
        </section>
      </div>
    </div>
  );
}

function ActionLink({
  href,
  icon,
  label,
  external,
  primary,
  danger,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  external?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const tone = danger ? "bg-emergency text-white" : primary ? "bg-primary text-white" : "bg-surface text-ink ring-1 ring-line";
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold ${tone}`}
    >
      {icon}
      {label}
    </a>
  );
}
