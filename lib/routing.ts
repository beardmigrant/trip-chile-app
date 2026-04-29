// ============== OSRM ROUTING ==============
import type { OSRMRoute } from '@/types';
import { haversine } from './utils';

const OSRM_ENDPOINTS = [
  'https://router.project-osrm.org/route/v1/driving/',
  'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
];

/** Fetch con timeout usando AbortController */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Calcular timeout dinámico según distancia */
function calcTimeout(distanceKm: number): number {
  if (distanceKm < 300) return 15000;
  if (distanceKm < 700) return 25000;
  if (distanceKm < 1500) return 40000;
  return 60000;
}

/**
 * Obtener ruta real por carreteras desde OSRM público.
 * Prueba 2 endpoints, retorna null si todos fallan.
 */
export async function fetchOSRMRoute(
  origin: [number, number],
  dest: [number, number],
  waypoints: [number, number][] = []
): Promise<OSRMRoute | null> {
  const points = [origin, ...waypoints, dest];
  // OSRM espera lng,lat (no lat,lng)
  const coords = points.map((p) => `${p[1]},${p[0]}`).join(';');
  const params = '?overview=full&geometries=geojson&steps=false&alternatives=false';

  const distance = haversine(origin, dest);
  const timeoutMs = calcTimeout(distance);

  for (const baseUrl of OSRM_ENDPOINTS) {
    const url = `${baseUrl}${coords}${params}`;
    try {
      const res = await fetchWithTimeout(
        url,
        { headers: { Accept: 'application/json' } },
        timeoutMs
      );
      if (!res.ok) continue;

      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.length > 0) {
        return data.routes[0] as OSRMRoute;
      }
    } catch (e) {
      // Continuar con siguiente endpoint
      console.warn(`OSRM ${baseUrl} falló:`, e);
    }
  }
  return null;
}
