/// <reference lib="webworker" />
import MiniSearch from "minisearch";

export interface SearchDoc {
  id: string;
  name: string;
  campus: string;
  bestFor: string;
  /** Constituency name plus neighbourhoods. */
  area: string;
  /** Address, notes and facts. */
  extra: string;
}

export type SearchRequest = { type: "init"; docs: SearchDoc[] } | { type: "query"; reqId: number; q: string };
export type SearchResponse = { type: "ready" } | { type: "result"; reqId: number; ids: string[] };

let engine: MiniSearch<SearchDoc> | null = null;

self.onmessage = (e: MessageEvent<SearchRequest>) => {
  const msg = e.data;
  if (msg.type === "init") {
    engine = new MiniSearch<SearchDoc>({
      fields: ["name", "campus", "bestFor", "area", "extra"],
      searchOptions: {
        prefix: true,
        fuzzy: (term) => (term.length > 4 ? 0.2 : false),
        boost: { name: 4, campus: 1.5, area: 1.5 },
        combineWith: "AND",
      },
    });
    engine.addAll(msg.docs);
    (self as DedicatedWorkerGlobalScope).postMessage({ type: "ready" } satisfies SearchResponse);
    return;
  }
  const ids = engine ? engine.search(msg.q).slice(0, 400).map((r) => String(r.id)) : [];
  (self as DedicatedWorkerGlobalScope).postMessage({ type: "result", reqId: msg.reqId, ids } satisfies SearchResponse);
};
