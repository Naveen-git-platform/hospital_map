import { Ambulance, ChevronLeft, Navigation, Phone, Search, X } from "lucide-react";
import { useDeferredValue } from "react";
import {
  dotClass,
  FILTER_INTROS,
  FILTERS,
  firstRecommended,
  getHospital,
  getSeat,
  groupBySeat,
  hospitalsForSeat,
  mapsHref,
  SEAT_GUIDES,
  SEATS,
  searchHospitals,
  seatMatches,
  statusLabel,
  telHref,
} from "../lib/data";
import { PC_ORDER } from "../lib/theme";
import type { FilterId, Hospital, SeatProps } from "../lib/types";

const SECTION_HEADING = "px-4 pt-4 pb-2 text-xs font-semibold tracking-widest text-muted uppercase";

export interface GuideProps {
  query: string;
  setQuery: (q: string) => void;
  filter: FilterId;
  setFilter: (f: FilterId) => void;
  seatId: string | null;
  hospitalId: string | null;
  onSelectSeat: (id: string) => void;
  onSelectHospital: (id: string) => void;
  onBack: () => void;
}

export function Guide(props: GuideProps) {
  const hospital = props.hospitalId ? getHospital(props.hospitalId) : undefined;
  const seat = props.seatId ? getSeat(props.seatId) : undefined;
  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
        <label className="relative block">
          <span className="sr-only">Search constituencies and hospitals</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            value={props.query}
            onChange={(e) => props.setQuery(e.target.value)}
            placeholder="KIMS, Apollo, Yashoda…"
            className="min-h-11 w-full rounded-lg border border-line bg-paper-2 pr-10 pl-9 text-sm text-ink outline-none placeholder:text-muted focus:border-forest"
          />
          {props.query ? (
            <button
              type="button"
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted"
              onClick={() => props.setQuery("")}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => {
            const active = props.filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => props.setFilter(f.id)}
                className={
                  active
                    ? "min-h-11 shrink-0 rounded-full border border-forest bg-forest px-3 text-sm font-semibold text-paper"
                    : "min-h-11 shrink-0 rounded-full border border-line bg-paper px-3 text-sm font-medium text-ink"
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
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

function Overview({ query, filter, onSelectSeat, onSelectHospital }: GuideProps) {
  const q = useDeferredValue(query).trim().toLowerCase();
  if (!q && filter === "about") return <About onSelectSeat={onSelectSeat} />;
  if (!q) return <FilterView filter={filter} onSelectHospital={onSelectHospital} />;

  const seats = SEATS.filter((s) => seatMatches(s, q, filter));
  const hospitals = searchHospitals(q, filter);
  if (seats.length === 0 && hospitals.length === 0) {
    return <p className="px-4 py-8 text-sm text-muted">Nothing matches. Try Yakutpura, TIMS, Malakpet, or heart.</p>;
  }
  return (
    <div className="flex flex-col">
      {hospitals.length > 0 ? (
        <section>
          <h2 className={SECTION_HEADING}>Hospitals</h2>
          <ul>
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
        <h2 className={SECTION_HEADING}>{pc}</h2>
        <ul>
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

function About({ onSelectSeat }: { onSelectSeat: (id: string) => void }) {
  return (
    <div className="flex flex-col">
      <section className="border-b border-line px-4 py-4">
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">How to read this map</p>
        <h2 className="mt-1 font-display text-2xl leading-tight">Hyderabad, one filter at a time</h2>
        <p className="mt-2 text-sm leading-relaxed">
          The colours are the 23 assembly constituencies. A pin sits on the colour its gate falls in. Open a colour below
          to see only the hospitals that serve it. Open a filter to keep one kind of hospital and hide the rest. The map
          follows the same cut.
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          <li className="rounded-lg bg-paper-2 px-3 py-2">
            <span className="font-semibold">Hospitals.</span>{" "}
            <span className="text-muted">
              All shows every hospital. Government, Corporate, Trust and NGO, Military, and Mid-size each keep one kind.
              Projects keeps campuses that are not open yet. Top hospitals, Heart, Cancer, Women and child, and Emergency
              are narrower cuts of the same list.
            </span>
          </li>
          <li className="rounded-lg bg-paper-2 px-3 py-2">
            <span className="font-semibold">Government clinics.</span>{" "}
            <span className="text-muted">
              Health centres, primary centres, wellness clinics, sub-centres and dispensaries come from the Telangana
              health-centre file. Only rows inside these 23 colours are kept. They stay out of the hospital filters so a
              hospital search is not buried under clinics.
            </span>
          </li>
          <li className="rounded-lg bg-paper-2 px-3 py-2">
            <span className="font-semibold">What was left out.</span>{" "}
            <span className="text-muted">
              A centre from another district whose coordinate landed here by mistake. A famous hospital whose coordinate
              pointed at the wrong neighbourhood. Those pins were not used.
            </span>
          </li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The colours follow a simplified public map, so a campus can sit one seat off the neighbourhood people use. This
          is a guide to where care sits, not a clinical ranking.
        </p>
        <p className="mt-3 text-xs text-muted">
          Data and notes adapted from{" "}
          <a href="https://hydshealthcare.auka.ai/" target="_blank" rel="noreferrer" className="underline">
            hydshealthcare.auka.ai
          </a>
          .
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
    <div className="flex flex-col">
      <section className="border-b border-line px-4 py-4">
        <h2 className="font-display text-2xl leading-tight">{intro.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{intro.line}</p>
        <p className="mt-2 text-xs font-medium text-forest">
          {onMap} on the map{offMap > 0 ? ` · ${offMap} outside the city, listed here only` : ""}
        </p>
      </section>
      {list.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted">Nothing in this section.</p>
      ) : flat ? (
        <ul>
          {list.map((h) => (
            <li key={h.id}>
              <HospitalRow hospital={h} showArea onSelect={onSelectHospital} />
            </li>
          ))}
        </ul>
      ) : (
        groupBySeat(list).map((group) => (
          <section key={group.label}>
            <h3 className={SECTION_HEADING}>{group.label}</h3>
            <ul>
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
      className="flex w-full min-h-11 flex-col gap-1 border-b border-line px-4 py-3 text-left hover:bg-paper-2"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-display text-lg leading-tight">{seat.name}</span>
        <span className="shrink-0 text-xs text-muted">
          {count} hospital{count === 1 ? "" : "s"}
        </span>
      </span>
      <span className="text-sm text-muted">{SEAT_GUIDES[seat.id]?.places}</span>
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
  const first = firstRecommended(list);
  return (
    <div>
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 px-3 text-sm font-medium text-forest">
        <ChevronLeft className="size-4" />
        All seats
      </button>
      <div className="px-4 pb-3">
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">
          AC {seat.acNo} · {seat.pc} · {seat.district}
        </p>
        <h2 className="mt-1 font-display text-3xl leading-tight">{seat.name}</h2>
        <p className="mt-2 text-sm text-muted">{guide?.places}</p>
        {guide?.guide ? <p className="mt-3 text-sm leading-relaxed">{guide.guide}</p> : null}
      </div>
      {list.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">No hospital in this seat matches that filter.</p>
      ) : (
        <ul>
          {list.map((h) => (
            <li key={h.id}>
              <HospitalRow hospital={h} seatId={seat.id} first={h.id === first} onSelect={onSelectHospital} />
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
  first,
  showArea,
  onSelect,
}: {
  hospital: Hospital;
  seatId?: string;
  first?: boolean;
  showArea?: boolean;
  onSelect: (id: string) => void;
}) {
  const inSeat = !!seatId && h.seat === seatId;
  const area = h.offMap ? "Outside Hyderabad" : (getSeat(h.seat)?.name ?? "");
  return (
    <button
      type="button"
      onClick={() => onSelect(h.id)}
      className="flex w-full min-h-11 gap-3 border-b border-line px-4 py-3 text-left hover:bg-paper-2"
    >
      <span className={dotClass(h)} aria-hidden />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{h.name}</span>
          <span className="text-xs text-muted">{statusLabel(h)}</span>
          {first ? <span className="text-xs font-semibold text-forest">Start here</span> : null}
        </span>
        <span className="mt-0.5 block text-sm text-muted">
          {h.campus}
          {showArea && area ? ` · ${area}` : null}
          {!showArea && seatId ? (inSeat ? " · in this seat" : " · nearby") : null}
        </span>
        <span className="mt-0.5 block text-sm">{h.bestFor}</span>
      </span>
    </button>
  );
}

function HospitalDetail({ hospital: h, onBack }: { hospital: Hospital; onBack: () => void }) {
  const seat = getSeat(h.seat);
  return (
    <div className="px-4 py-3">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 text-sm font-medium text-forest">
        <ChevronLeft className="size-4" />
        {seat?.name ?? "Back"}
      </button>
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">
        {statusLabel(h)} · {h.campus}
      </p>
      <h2 className="mt-1 font-display text-3xl leading-tight">{h.name}</h2>
      <p className="mt-2 text-sm font-medium text-forest">{h.bestFor}</p>
      {h.field ? <p className="mt-3 text-sm leading-relaxed">{h.field}</p> : null}
      <p className="mt-3 text-sm leading-relaxed">{h.note}</p>
      {h.facts && h.facts.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {h.facts.map((fact) => (
            <li key={fact} className="border-l-2 border-forest pl-3 text-sm leading-relaxed">
              {fact}
            </li>
          ))}
        </ul>
      ) : null}
      {h.caution ? (
        <p className="mt-3 rounded-lg border border-line bg-paper-2 px-3 py-2 text-sm leading-relaxed">{h.caution}</p>
      ) : null}
      <p className="mt-3 text-sm text-muted">{h.address}</p>
      <p className="mt-1 text-sm text-muted">
        {h.offMap
          ? "Outside the Hyderabad constituencies on this map. No pin."
          : `Drawn inside ${seat?.name ?? "this map"}${seat ? ` · ${seat.pc}` : ""}`}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {h.phone ? (
          <a
            href={telHref(h.phone)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-forest px-4 text-sm font-semibold text-paper"
          >
            <Phone className="size-4" />
            {h.phone}
          </a>
        ) : null}
        <a
          href={mapsHref(h)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-paper-2 px-4 text-sm font-semibold text-ink"
        >
          <Navigation className="size-4" />
          {h.offMap ? "Search on Maps" : "Directions"}
        </a>
        <a
          href="tel:108"
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink"
        >
          <Ambulance className="size-4" />
          Ambulance 108
        </a>
      </div>
    </div>
  );
}

/** Floating summary over the map on phones, for the current seat or hospital. */
export function MobileCard({
  seatId,
  hospitalId,
  onOpenGuide,
}: {
  seatId: string | null;
  hospitalId: string | null;
  onOpenGuide: () => void;
}) {
  const hospital = hospitalId ? getHospital(hospitalId) : undefined;
  const seat = seatId ? getSeat(seatId) : undefined;
  if (!hospital && !seat) return null;
  const title = hospital ? hospital.name : seat?.name;
  const body = hospital ? `${statusLabel(hospital)} · ${hospital.bestFor}` : SEAT_GUIDES[seat?.id ?? ""]?.guide;
  return (
    <div className="absolute inset-x-3 bottom-12 max-h-[60%] overflow-y-auto rounded-xl border border-line bg-paper p-3 text-ink shadow-sm md:hidden">
      <p className="font-display text-xl leading-tight">{title}</p>
      <p className="mt-1 line-clamp-3 text-sm text-muted">{body}</p>
      <div className="mt-3 flex gap-2">
        {hospital?.phone ? (
          <a
            href={telHref(hospital.phone)}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-forest text-sm font-semibold text-paper"
          >
            <Phone className="size-4" />
            Call
          </a>
        ) : null}
        <button
          type="button"
          onClick={onOpenGuide}
          className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-line text-sm font-semibold"
        >
          Open guide
        </button>
      </div>
    </div>
  );
}

