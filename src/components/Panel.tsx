import {
  ArrowLeft,
  Ambulance,
  CircleCheck,
  Info,
  MapPin,
  Navigation,
  PanelLeftClose,
  Phone,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { type ReactNode, useDeferredValue, useEffect, useRef } from "react";
import {
  FILTER_GROUPS,
  FILTER_INTROS,
  firstRecommended,
  getHospital,
  getSeat,
  groupBySeat,
  groupOfFilter,
  HOSPITALS,
  hospitalsForSeat,
  mapsHref,
  markerKind,
  SEAT_GUIDES,
  SEATS,
  searchHospitals,
  seatMatches,
  statusLabel,
  telHref,
} from "../lib/data";
import { APP_CITY, APP_NAME, glyphSvg, MARKER_KINDS, palette, PC_ORDER } from "../lib/theme";
import type { FilterId, Hospital, SeatProps } from "../lib/types";

export type SheetState = "peek" | "half" | "full";

const HOSPITAL_COUNT = HOSPITALS.filter((h) => !h.clinic).length;
const CLINIC_COUNT = HOSPITALS.length - HOSPITAL_COUNT;

const GROUP_LABEL = "px-5 pt-5 pb-2 text-[11px] font-bold tracking-[0.12em] text-subtle uppercase";

export interface PanelProps {
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
          <p className="mt-1 text-xs font-medium text-subtle">{APP_CITY} hospitals & clinics</p>
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
            placeholder="Search hospitals, areas, specialities…"
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
                    active
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line text-ink hover:border-subtle"
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
        {hospital ? (
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
      <svg viewBox="0 0 24 24" className={small ? "size-4.5" : "size-6"} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" />
        <path d="M12 7v6M9 10h6" />
      </svg>
    </span>
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

function Overview({ query, filter, onSelectSeat, onSelectHospital }: PanelProps) {
  const q = useDeferredValue(query).trim().toLowerCase();
  if (!q && filter === "about") return <Welcome onSelectSeat={onSelectSeat} />;
  if (!q) return <FilterView filter={filter} onSelectHospital={onSelectHospital} />;

  const seats = SEATS.filter((s) => seatMatches(s, q, filter));
  const hospitals = searchHospitals(q, filter);
  if (seats.length === 0 && hospitals.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <Search className="mx-auto size-8 text-line" />
        <p className="mt-3 text-sm font-semibold">No results</p>
        <p className="mt-1 text-sm text-subtle">Try “Apollo”, “Malakpet” or “cancer”.</p>
      </div>
    );
  }
  return (
    <div>
      {hospitals.length > 0 ? (
        <section>
          <h2 className={GROUP_LABEL}>
            Places <span className="text-ink">· {hospitals.length}</span>
          </h2>
          <ul className="flex flex-col gap-1 px-2">
            {hospitals.map((h) => (
              <li key={h.id}>
                <HospitalRow hospital={h} showArea onSelect={onSelectHospital} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <SeatGroups seats={seats} filter={filter} onSelect={onSelectSeat} />
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
          <span className="size-2.5 rounded-full" style={{ background: palette.pc[pc] }} />
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

function Welcome({ onSelectSeat }: { onSelectSeat: (id: string) => void }) {
  const steps = [
    {
      title: "Pick an area",
      body: "Each coloured shape is one of the city’s 23 assembly constituencies. Tap one to list the hospitals that serve it.",
    },
    {
      title: "Narrow it down",
      body: "Use Hospitals to filter by ownership, or Care for emergency, heart, cancer and maternity. The map follows your choice.",
    },
    {
      title: "Find a clinic",
      body: "Clinics lists government wellness, primary and community centres and dispensaries from the Telangana health-centre file.",
    },
  ];
  return (
    <div>
      <section className="px-5 pt-5">
        <h2 className="text-2xl leading-tight font-extrabold tracking-tight">Find care near you</h2>
        <p className="mt-2 text-sm leading-relaxed text-subtle">
          A directory of hospitals and government clinics across Greater Hyderabad, organised by constituency.
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {[
            { n: SEATS.length, label: "areas" },
            { n: HOSPITAL_COUNT, label: "hospitals" },
            { n: CLINIC_COUNT, label: "clinics" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-primary-soft px-3 py-3">
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-xl font-extrabold text-primary">{s.n}</dd>
              <dd className="text-xs font-medium text-primary/80">{s.label}</dd>
            </div>
          ))}
        </dl>
        <ol className="mt-4 flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold">{s.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-subtle">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex gap-2 rounded-2xl bg-canvas px-3 py-2.5 text-xs leading-relaxed text-subtle">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Boundaries are simplified, so a hospital near an edge may show in the neighbouring area. This is a directory,
            not a ranking of medical quality. Data adapted from{" "}
            <a href="https://hydshealthcare.auka.ai/" target="_blank" rel="noreferrer" className="font-semibold underline">
              hydshealthcare.auka.ai
            </a>
            .
          </span>
        </p>
      </section>
      <SeatGroups seats={SEATS} filter="about" onSelect={onSelectSeat} />
    </div>
  );
}

function FilterView({ filter, onSelectHospital }: { filter: FilterId; onSelectHospital: (id: string) => void }) {
  const intro = FILTER_INTROS[filter as Exclude<FilterId, "about">];
  const list = searchHospitals("", filter);
  const onMap = list.filter((h) => !h.offMap).length;
  const offMap = list.length - onMap;
  const flat = filter === "trusted" || filter === "projects";
  return (
    <div>
      <section className="px-5 pt-5 pb-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl leading-tight font-extrabold tracking-tight">{intro.title}</h2>
          <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
            {list.length}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-subtle">{intro.line}</p>
        {offMap > 0 ? (
          <p className="mt-1.5 text-xs text-subtle">
            {onMap} on the map · {offMap} outside the city (listed only)
          </p>
        ) : null}
      </section>
      {list.length === 0 ? (
        <p className="px-5 py-8 text-sm text-subtle">Nothing here yet.</p>
      ) : flat ? (
        <ul className="mt-2 flex flex-col gap-1 px-2">
          {list.map((h) => (
            <li key={h.id}>
              <HospitalRow hospital={h} showArea onSelect={onSelectHospital} />
            </li>
          ))}
        </ul>
      ) : (
        groupBySeat(list).map((group) => (
          <section key={group.label}>
            <h3 className={GROUP_LABEL}>
              {group.label} <span className="text-ink">· {group.hospitals.length}</span>
            </h3>
            <ul className="flex flex-col gap-1 px-2">
              {group.hospitals.map((h) => (
                <li key={h.id}>
                  <HospitalRow hospital={h} onSelect={onSelectHospital} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function SeatRow({ seat, filter, onSelect }: { seat: SeatProps; filter: FilterId; onSelect: (id: string) => void }) {
  const count = hospitalsForSeat(seat.id, filter).length;
  return (
    <button
      type="button"
      onClick={() => onSelect(seat.id)}
      className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-primary hover:shadow-sm"
    >
      <span className="w-1.5 self-stretch rounded-full" style={{ background: palette.pc[seat.pc] }} />
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{seat.name}</span>
        <span className="mt-0.5 line-clamp-1 block text-xs text-subtle">{SEAT_GUIDES[seat.id]?.places}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-lg leading-none font-extrabold text-primary">{count}</span>
        <span className="text-[10px] font-semibold text-subtle uppercase">{count === 1 ? "place" : "places"}</span>
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
  const inSeat = list.filter((h) => h.seat === seat.id).length;
  const first = firstRecommended(list);
  return (
    <div>
      <BackButton label="All areas" onClick={onBack} />
      <section className="px-5 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">AC {seat.acNo}</span>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold text-ink"
            style={{ background: palette.pc[seat.pc] }}
          >
            {seat.pc}
          </span>
          <span className="rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold text-subtle">{seat.district}</span>
        </div>
        <h2 className="mt-3 text-3xl leading-tight font-extrabold tracking-tight">{seat.name}</h2>
        <p className="mt-1 text-sm text-subtle">{guide?.places}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-primary-soft px-3 py-2.5">
            <p className="text-xl font-extrabold text-primary">{inSeat}</p>
            <p className="text-xs font-medium text-primary/80">inside this area</p>
          </div>
          <div className="rounded-2xl bg-canvas px-3 py-2.5">
            <p className="text-xl font-extrabold">{list.length - inSeat}</p>
            <p className="text-xs font-medium text-subtle">nearby that serve it</p>
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
          {list.map((h) => (
            <li key={h.id}>
              <HospitalRow hospital={h} seatId={seat.id} recommended={h.id === first} onSelect={onSelectHospital} />
            </li>
          ))}
        </ul>
      )}
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
  const area = h.offMap ? "Outside Hyderabad" : (getSeat(h.seat)?.name ?? "");
  const where = showArea ? area : seatId ? (h.seat === seatId ? "In this area" : "Nearby") : null;
  return (
    <button
      type="button"
      onClick={() => onSelect(h.id)}
      className="flex w-full gap-3 rounded-2xl p-3 text-left transition hover:bg-canvas"
    >
      <KindBadge hospital={h} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="font-bold leading-snug">{h.name}</span>
          {recommended ? (
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white uppercase">
              Best bet
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-subtle">
          {statusLabel(h)} · {h.campus}
          {where ? ` · ${where}` : ""}
        </span>
        <span className="mt-1 line-clamp-2 block text-sm text-ink/80">{h.bestFor}</span>
      </span>
    </button>
  );
}

function HospitalDetail({ hospital: h, onBack }: { hospital: Hospital; onBack: () => void }) {
  const seat = getSeat(h.seat);
  const kind = markerKind(h);
  const color = MARKER_KINDS[kind].color;
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
            <p className="text-sm text-subtle">{h.campus}</p>
          </div>
        </div>
        <h2 className="mt-3 text-2xl leading-tight font-extrabold tracking-tight">{h.name}</h2>
        <p className="mt-1 text-sm font-semibold text-ink/80">{h.bestFor}</p>
        <div className={`mt-4 grid gap-2 ${h.phone ? "grid-cols-3" : "grid-cols-2"}`}>
          {h.phone ? (
            <ActionLink href={telHref(h.phone)} icon={<Phone className="size-5" />} label="Call" primary />
          ) : null}
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
        <section>
          <h3 className="text-sm font-bold">Overview</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink/85">{h.note}</p>
        </section>
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
        <section className="rounded-2xl border border-line p-3">
          <p className="flex gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            {h.address}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-subtle">
            {h.offMap
              ? "Outside the constituencies on this map, so it has no marker."
              : `Mapped in ${seat?.name ?? "this area"}${seat ? ` (${seat.pc} Lok Sabha)` : ""}.`}
            {h.field ? ` ${h.field}` : ""}
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
  const tone = danger
    ? "bg-emergency text-white"
    : primary
      ? "bg-primary text-white"
      : "bg-surface text-ink ring-1 ring-line";
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

