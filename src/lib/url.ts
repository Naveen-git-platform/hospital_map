import { FILTER_GROUPS, getSeat } from "./data";
import type { FilterId, Hospital } from "./types";

const REPO = "https://github.com/Naveen-git-platform/hospital_map";
const FILTER_IDS = new Set<string>(FILTER_GROUPS.flatMap((g) => g.filters.map((f) => f.id)));

/** App state that lives in the address bar, so any view can be shared or bookmarked. */
export interface UrlState {
  /** Constituency id. */
  ac?: string | null;
  /** Facility id. */
  h?: string | null;
  f?: FilterId;
  q?: string;
}

export function readUrl(): UrlState {
  const p = new URLSearchParams(window.location.search);
  const f = p.get("f");
  return {
    ac: p.get("ac"),
    h: p.get("h"),
    f: f && FILTER_IDS.has(f) ? (f as FilterId) : undefined,
    q: p.get("q") ?? undefined,
  };
}

export function urlFor(s: UrlState): string {
  const p = new URLSearchParams();
  // A facility implies its constituency, so `h` alone is enough.
  if (s.h) p.set("h", s.h);
  else if (s.ac) p.set("ac", s.ac);
  if (s.f && s.f !== "about") p.set("f", s.f);
  if (s.q?.trim()) p.set("q", s.q.trim());
  const qs = p.toString();
  return `${window.location.pathname}${qs ? `?${qs}` : ""}`;
}

export function writeUrl(s: UrlState) {
  const next = urlFor(s);
  if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
}

/** Native share sheet where available, otherwise copy the link. */
export async function shareLink(title: string, s: UrlState): Promise<"shared" | "copied" | "failed"> {
  const url = new URL(urlFor(s), window.location.origin).toString();
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch (e) {
    // Dismissing the share sheet is not a failure.
    return e instanceof DOMException && e.name === "AbortError" ? "shared" : "failed";
  }
}

/** Prefilled GitHub issue for correcting a listing. */
export function reportHref(h: Hospital): string {
  const page = new URL(urlFor({ h: h.id }), window.location.origin).toString();
  const body = [
    `**Listing:** ${h.name} (${h.id})`,
    `**Constituency:** ${getSeat(h.seat)?.name ?? "—"}`,
    `**Link:** ${page}`,
    "",
    "**What’s wrong?** (closed, wrong location, wrong phone, wrong type, duplicate…)",
    "",
    "",
    "**Correct details, if you know them:**",
    "",
  ].join("\n");
  const params = new URLSearchParams({ title: `Listing correction: ${h.name}`, body, labels: "data" });
  return `${REPO}/issues/new?${params}`;
}
