export type Tier = "flagship" | "public" | "specialty";
export type Focus = "heart" | "cancer" | "transplant" | "emergency" | "gastro" | "neuro" | "women-child";
export type ClinicKind = "community" | "primary" | "wellness" | "subcentre" | "dispensary";

/** A hospital or government clinic. Clinics carry `clinic`; curated hospitals do not. */
export interface Hospital {
  id: string;
  name: string;
  campus: string;
  /** Constituency id whose polygon the gate falls in. */
  seat: string;
  /** Constituency ids this campus serves (always includes `seat`). */
  serves: string[];
  tier: Tier;
  focus: Focus[];
  /** Sort order within lists; lower first. */
  rank: number;
  /** Present on the "Top hospitals" set; lower is more prominent. */
  lead?: number;
  bestFor: string;
  lat: number;
  lng: number;
  phone?: string;
  address: string;
  note: string;
  /** Explains where the pin sits relative to the constituency map. */
  field?: string;
  facts?: string[];
  caution?: string;
  closed?: boolean;
  project?: boolean;
  expanding?: boolean;
  phase?: "open" | "building";
  gapPin?: boolean;
  /** Outside the mapped constituencies; listed but not pinned. */
  offMap?: boolean;
  clinic?: ClinicKind;
}

export interface SeatProps {
  id: string;
  name: string;
  acNo: number;
  pc: ParliamentaryConstituency;
  district: string;
  /** Label position. */
  lng: number;
  lat: number;
}

export type ParliamentaryConstituency = "Secunderabad" | "Hyderabad" | "Malkajgiri" | "Chevella";

export interface SeatGuide {
  mapLabel: string;
  places: string;
  guide: string;
}

export type SeatFeature = GeoJSON.Feature<GeoJSON.Polygon, SeatProps> & { id: string };
export interface SeatCollection {
  type: "FeatureCollection";
  features: SeatFeature[];
}

export type FilterId =
  | "about"
  | "all"
  | "government"
  | "corporate"
  | "trust"
  | "military"
  | "midsized"
  | ClinicKind
  | "projects"
  | "trusted"
  | "heart"
  | "cancer"
  | "women-child"
  | "emergency";

export type HospitalKind = "government" | "corporate" | "trust" | "military" | "midsized";

export type MarkerKind = "govt" | "leading" | "private" | "project" | "closed" | "clinic";
