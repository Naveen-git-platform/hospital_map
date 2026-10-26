import type { MarkerKind } from "./types";

export const APP_NAME = "CareMap";
export const APP_REGION = "Telangana";

/** Colours used inside MapLibre paint expressions and marker HTML (CSS tokens live in styles.css). */
export const palette = {
  primary: "#0f766e",
  primaryDeep: "#134e4a",
  ink: "#0f172a",
  outline: "#64748b",
  surface: "#ffffff",
  muted: "#94a3b8",
  me: "#2563eb",
};

/** Seventeen soft hues, one per Lok Sabha seat, spaced so neighbours differ. */
const PC_HUES = [200, 25, 140, 280, 55, 330, 175, 95, 245, 10, 160, 300, 70, 220, 120, 350, 40];

export function pcColor(pc: string, order: string[]): string {
  const i = Math.max(0, order.indexOf(pc));
  return `hsl(${PC_HUES[i % PC_HUES.length]} 70% 72%)`;
}

/** 24×24 stroke icons drawn inside map markers (hand-kept so markers need no React). */
const GLYPHS: Record<MarkerKind, string> = {
  govt: '<path d="M12 6v12M6 12h12"/>',
  leading: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  private: '<path d="M7 20V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v14M4 20h16M10 9h4M10 13h4M11 20v-3h2v3"/>',
  project: '<circle cx="12" cy="12" r="7"/><path d="M12 8v4l2.5 2"/>',
  closed: '<path d="m8 8 8 8M16 8l-8 8"/>',
  clinic: '<path d="M12 7v10M7 12h10"/>',
  pclinic: '<path d="M9 5v5a3 3 0 0 0 6 0V5M12 13v2a4 4 0 0 0 8 0v-2"/><circle cx="20" cy="11" r="1.5"/>',
};

export const MARKER_KINDS: Record<MarkerKind, { label: string; color: string; glyph: string }> = {
  govt: { label: "Government", color: "#0f766e", glyph: GLYPHS.govt },
  leading: { label: "Featured", color: "#7c3aed", glyph: GLYPHS.leading },
  private: { label: "Private", color: "#2563eb", glyph: GLYPHS.private },
  project: { label: "Upcoming", color: "#d97706", glyph: GLYPHS.project },
  closed: { label: "Closed", color: "#94a3b8", glyph: GLYPHS.closed },
  clinic: { label: "Govt clinic", color: "#14b8a6", glyph: GLYPHS.clinic },
  pclinic: { label: "Private clinic", color: "#818cf8", glyph: GLYPHS.pclinic },
};

export const glyphSvg = (kind: MarkerKind, className = "") =>
  `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[kind]}</svg>`;

/** A standalone teardrop marker image (used as a MapLibre icon), drawn at 2× for sharpness. */
export function markerImageSvg(kind: MarkerKind): string {
  const { color } = MARKER_KINDS[kind];
  const hollow = kind === "private";
  const fill = hollow ? "#ffffff" : color;
  const stroke = hollow ? color : "#ffffff";
  const glyphColor = hollow ? color : "#ffffff";
  // 30×40 viewbox: round head (r=13) at (15,14) tapering to a point at (15,38).
  return `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="80" viewBox="0 0 30 40">
<defs><filter id="s" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#0f172a" flood-opacity="0.35"/></filter></defs>
<path filter="url(#s)" d="M15 38c-1.2-3.6-3.4-6.6-6.6-9.4A13 13 0 1 1 21.6 28.6C18.4 31.4 16.2 34.4 15 38z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
<g transform="translate(7.8 6.8) scale(0.6)" fill="none" stroke="${glyphColor}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[kind]}</g>
</svg>`;
}
