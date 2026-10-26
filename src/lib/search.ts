import { useEffect, useState } from "react";
import type { SearchDoc, SearchRequest, SearchResponse } from "../workers/search.worker";
import { getSeat, HOSPITALS, SEAT_GUIDES } from "./data";

let worker: Worker | null = null;
let nextReq = 1;
const pending = new Map<number, (ids: string[]) => void>();

/** Starts the search worker and indexes every facility. Call once after loadData(). */
export function initSearch() {
  if (worker) return;
  worker = new Worker(new URL("../workers/search.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<SearchResponse>) => {
    const msg = e.data;
    if (msg.type !== "result") return;
    pending.get(msg.reqId)?.(msg.ids);
    pending.delete(msg.reqId);
  };
  const docs: SearchDoc[] = HOSPITALS.map((h) => ({
    id: h.id,
    name: h.name,
    campus: h.campus,
    bestFor: h.bestFor,
    area: `${getSeat(h.seat)?.name ?? ""} ${SEAT_GUIDES[h.seat]?.places ?? ""}`,
    extra: [h.address, h.note ?? "", h.field ?? "", ...(h.facts ?? [])].join(" "),
  }));
  worker.postMessage({ type: "init", docs } satisfies SearchRequest);
}

function query(q: string): Promise<string[]> {
  if (!worker) return Promise.resolve([]);
  const reqId = nextReq++;
  return new Promise((resolve) => {
    pending.set(reqId, resolve);
    worker?.postMessage({ type: "query", reqId, q } satisfies SearchRequest);
  });
}

/** Facility ids matching `q`, best match first. Stale responses are dropped. */
export function useSearch(q: string): { ids: string[] | null } {
  const [state, setState] = useState<{ q: string; ids: string[] } | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    let current = true;
    void query(term).then((ids) => {
      if (current) setState({ q: term, ids });
    });
    return () => {
      current = false;
    };
  }, [q]);
  return { ids: state && state.q === q.trim() ? state.ids : null };
}
