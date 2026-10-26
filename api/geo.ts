// Vercel Edge Function: approximate visitor location from the request's IP.
// Vercel adds these headers at the edge; no third-party lookup and nothing is stored.
export const config = { runtime: "edge" };

export default function handler(request: Request): Response {
  const h = request.headers;
  const lat = Number.parseFloat(h.get("x-vercel-ip-latitude") ?? "");
  const lng = Number.parseFloat(h.get("x-vercel-ip-longitude") ?? "");
  const city = decodeURIComponent(h.get("x-vercel-ip-city") ?? "");
  const body = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, city } : { lat: null, lng: null, city: null };
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      // Per-visitor answer: never cache at the CDN.
      "cache-control": "private, no-store",
    },
  });
}
