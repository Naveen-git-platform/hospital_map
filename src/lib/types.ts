export type Tier = "flagship" | "public" | "specialty";
export type Focus = "heart" | "cancer" | "transplant" | "emergency" | "gastro" | "neuro" | "women-child";
export type ClinicKind = "community" | "primary" | "wellness" | "subcentre" | "dispensary" | "private";
export type Ownership = "government" | "private" | "charitable" | "military";

/** A hospital or clinic. Clinics carry `clinic`; hospitals do not. */
export interface Hospital {
  id: string;
  name: string;
  campus: string;
  /** Constituency id whose polygon the facility sits in. */
  seat: string;
  /** Constituency ids this facility serves (always includes `seat`). */
  serves: string[];
  tier: Tier;
  focus: Focus[];
  /** Sort order within lists; lower first. */
  rank: number;
  /** Present on the curated "Featured" set; lower is more prominent. */
  lead?: number;
  bestFor: string;
  lat: number;
  lng: number;
  phone?: string;
  address: string;
  /** Curated description; absent for OpenStreetMap / open-data rows. */
  note?: string;
  facts?: string[];
  caution?: string;
  closed?: boolean;
  project?: boolean;
  expanding?: boolean;
  phase?: "open" | "building";
  /** Outside the mapped constituencies; listed but not pinned. */
  offMap?: boolean;
  clinic?: ClinicKind;
  /** Where the record came from. */
  src?: "curated" | "govt" | "osm";
  own?: Ownership;
  /** Private hospital belonging to a large chain. */
  corporate?: boolean;
  beds?: number;
}

export interface SeatProps {
  id: string;
  name: string;
  acNo: number;
  /** Lok Sabha (parliamentary) constituency. */
  pc: string;
  /** Label position. */
  lng: number;
  lat: number;
}

export interface SeatGuide {
  mapLabel: string;
  places: string;
  guide: string;
}

export type SeatGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type SeatFeature = GeoJSON.Feature<SeatGeometry, SeatProps> & { id: string };
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

export type MarkerKind = "govt" | "leading" | "private" | "project" | "closed" | "clinic" | "pclinic";

export interface LatLng {
  lat: number;
  lng: number;
}
