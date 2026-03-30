import type { Visit } from "./types";
import { hasCoords } from "./geocode";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(order: number[], dist: number[][]): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += dist[order[i]][order[i + 1]];
  }
  return total;
}

function nearestNeighbor(n: number, dist: number[][]): number[] {
  let bestOrder: number[] = [];
  let bestDist = Infinity;

  for (let start = 0; start < n; start++) {
    const visited = new Set<number>();
    const order = [start];
    visited.add(start);

    while (order.length < n) {
      const last = order[order.length - 1];
      let nearest = -1;
      let nearestDist = Infinity;
      for (let j = 0; j < n; j++) {
        if (!visited.has(j) && dist[last][j] < nearestDist) {
          nearest = j;
          nearestDist = dist[last][j];
        }
      }
      order.push(nearest);
      visited.add(nearest);
    }

    const d = totalDistance(order, dist);
    if (d < bestDist) {
      bestDist = d;
      bestOrder = order;
    }
  }

  return bestOrder;
}

function twoOpt(order: number[], dist: number[][]): number[] {
  const n = order.length;
  let improved = true;
  const result = [...order];

  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        const d1 = dist[result[i]][result[i + 1]] + (j + 1 < n ? dist[result[j]][result[j + 1]] : 0);
        const d2 = dist[result[i]][result[j]] + (j + 1 < n ? dist[result[i + 1]][result[j + 1]] : 0);
        if (d2 < d1 - 1e-10) {
          const reversed = result.slice(i + 1, j + 1).reverse();
          result.splice(i + 1, reversed.length, ...reversed);
          improved = true;
        }
      }
    }
  }

  return result;
}

export function optimizeVisitOrder(visits: Visit[]): Visit[] {
  const geoVisits = visits.filter((v) => hasCoords(v.lat, v.lng));
  const noGeo = visits.filter((v) => !hasCoords(v.lat, v.lng));

  if (geoVisits.length <= 2) return [...geoVisits, ...noGeo];

  const n = geoVisits.length;
  const dist: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(geoVisits[i].lat!, geoVisits[i].lng!, geoVisits[j].lat!, geoVisits[j].lng!);
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }

  const nnOrder = nearestNeighbor(n, dist);
  const optimized = twoOpt(nnOrder, dist);

  return [...optimized.map((i) => geoVisits[i]), ...noGeo];
}
