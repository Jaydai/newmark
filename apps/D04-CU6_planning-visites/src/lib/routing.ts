import type { RouteSegment } from "./types";

export async function calcRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RouteSegment | null> {
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    if (d.code !== "Ok" || !d.routes.length) return null;
    const route = d.routes[0];
    return {
      duration: Math.round(route.duration / 60),
      distance: (route.distance / 1000).toFixed(1),
      geometry: route.geometry,
    };
  } catch {
    return null;
  }
}
