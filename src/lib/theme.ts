import type { ParliamentaryConstituency } from "./types";

/** Colours used inside MapLibre paint expressions (CSS tokens live in styles.css). */
export const palette = {
  forest: "#1f6b4a",
  forestDeep: "#143d2c",
  ink: "#14201c",
  line: "#6b6256",
  paper: "#f4efe6",
  muted: "#5e6b63",
  pc: {
    Hyderabad: "#e4d2b0",
    Secunderabad: "#b7cbb8",
    Malkajgiri: "#d5cfc3",
    Chevella: "#e4cbbd",
  } satisfies Record<ParliamentaryConstituency, string>,
};

/** Order of parliamentary-constituency groups in the guide. */
export const PC_ORDER: ParliamentaryConstituency[] = ["Secunderabad", "Hyderabad", "Malkajgiri", "Chevella"];
