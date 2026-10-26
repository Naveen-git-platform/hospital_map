import type { MarkerKind, ParliamentaryConstituency } from "./types";

export const APP_NAME = "CareMap";
export const APP_CITY = "Hyderabad";

/** Colours used inside MapLibre paint expressions and marker HTML (CSS tokens live in styles.css). */
export const palette = {
  primary: "#0f766e",
  primaryDeep: "#134e4a",
  ink: "#0f172a",
  outline: "#64748b",
  surface: "#ffffff",
  muted: "#94a3b8",
  pc: {
    Hyderabad: "#a5b4fc",
    Secunderabad: "#6ee7b7",
    Malkajgiri: "#f9a8d4",
    Chevella: "#fdba74",
  } satisfies Record<ParliamentaryConstituency, string>,
};

/** Order of parliamentary-constituency groups in the panel. */
export const PC_ORDER: ParliamentaryConstituency[] = ["Secunderabad", "Hyderabad", "Malkajgiri", "Chevella"];

/** 24×24 stroke icons drawn inside map markers (hand-kept so markers need no React). */
const GLYPHS: Record<MarkerKind, string> = {
  govt: '<path d="M12 6v12M6 12h12"/>',
  leading: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  private: '<path d="M7 20V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v14M4 20h16M10 9h4M10 13h4M11 20v-3h2v3"/>',
  project: '<circle cx="12" cy="12" r="7"/><path d="M12 8v4l2.5 2"/>',
  closed: '<path d="m8 8 8 8M16 8l-8 8"/>',
  clinic: '<path d="M12 7v10M7 12h10"/>',
};

export const MARKER_KINDS: Record<MarkerKind, { label: string; color: string; glyph: string }> = {
  govt: { label: "Government", color: "#0f766e", glyph: GLYPHS.govt },
  leading: { label: "Top rated", color: "#7c3aed", glyph: GLYPHS.leading },
  private: { label: "Private", color: "#2563eb", glyph: GLYPHS.private },
  project: { label: "Upcoming", color: "#d97706", glyph: GLYPHS.project },
  closed: { label: "Closed", color: "#94a3b8", glyph: GLYPHS.closed },
  clinic: { label: "Clinic", color: "#14b8a6", glyph: GLYPHS.clinic },
};

export const glyphSvg = (kind: MarkerKind, className = "") =>
  `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[kind]}</svg>`;
