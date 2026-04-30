// ============== BÚSQUEDA DE POIs EN CORREDOR DE RUTA ==============
// v2 FIXED:
// - Queries simplificados (1-2 palabras) para mejor matching en zonas rurales
// - maxDetour aumentado a 25km (default) — corredor más realista
// - Logs adicionales por punto de búsqueda para diagnosticar coverage

import type { OSRMRoute } from '@/types';
import { searchPlacesNearby, type GooglePlace } from './google-places';
import { distToSegment } from './utils';
import { POI_CATEGORIES } from './constants';

export interface POISuggestion extends GooglePlace {
  distFromOrigin: number;
  detour: number;
  category: keyof typeof POI_CATEGORIES;
}

const CATEGORY_TO_GOOGLE_TYPE: Record<string, string> = {
  lodging: 'lodging',
  food: 'restaurant',
  historic: 'museum',
  attraction: 'tourist_attraction',
  nature: 'park',
  recreation: 'amusement_park',
  astro: 'tourist_attraction',
  services: 'gas_station',
};

// Queries SIMPLIFICADOS — 1 palabra clave por categoría
// Razón: queries largos como "parque nacional reserva natural cascada laguna"
// no matchean en zonas rurales y Google expande la búsqueda como fallback.
const CATEGORY_QUERIES: Record<string, string> = {
  lodging: 'hotel',
  food: 'restaurante',
  historic: 'museo',
  attraction: 'mirador',
  nature: 'parque',
  recreation: 'parque diversiones',
  astro: 'observatorio',
  services: 'bencinera',
};

/**
 * Busca POIs en el corredor de una ruta calculada.
 *
 * FIX v2: usa queries de 1 palabra + strictTypeFiltering en google-places.ts
 * para evitar el fallback expandido de Google que devolvía POIs de Santiago
 * cuando se buscaba en zonas rurales (Talca, Chillán, Temuco, etc).
 */
export async function searchPOIsAlongRoute(
  routeGeometry: OSRMRoute['geometry'],
  totalDistance: number,
  activeCategories: Set<string>,
  maxDetour: number = 25 // ← aumentado de 15 a 25km para mejor cobertura
): Promise<POISuggestion[]> {
  if (activeCategories.size === 0) return [];
  if (!routeGeometry?.coordinates || routeGeometry.coordinates.length < 2) return [];

  const coords = routeGeometry.coordinates.map(
    (c) => [c[1], c[0]] as [number, number]
  );

  // Espaciado: cada ~80km, máximo 6 puntos para optimizar costos
  const targetSpacing = 80;
  const numSearchPoints = Math.min(6, Math.max(2, Math.floor(totalDistance / targetSpacing)));

  const searchPoints: Array<{ lat: number; lng: number; progressKm: number }> = [];
  for (let i = 0; i < numSearchPoints; i++) {
    const progress = (i + 0.5) / numSearchPoints;
    const idx = Math.floor(progress * (coords.length - 1));
    const point = coords[idx];
    searchPoints.push({
      lat: point[0],
      lng: point[1],
      progressKm: progress * totalDistance,
    });
  }

  console.log(
    `🗺️ [POI Search] ${numSearchPoints} puntos a lo largo de ${totalDistance.toFixed(0)}km, radio ${maxDetour}km`
  );

  const allResults: POISuggestion[] = [];
  const usedPlaceIds = new Set<string>();

  for (const point of searchPoints) {
    const promises = Array.from(activeCategories).map(async (cat) => {
      const googleType = CATEGORY_TO_GOOGLE_TYPE[cat];
      const query =
        CATEGORY_QUERIES[cat] ||
        POI_CATEGORIES[cat as keyof typeof POI_CATEGORIES]?.label ||
        cat;

      const places = await searchPlacesNearby(query, {
        lat: point.lat,
        lng: point.lng,
        radius: maxDetour * 1000, // metros
        types: googleType ? [googleType] : undefined,
        minRating: 4.0,
        strict: true,
      });

      return { cat: cat as keyof typeof POI_CATEGORIES, places };
    });

    const results = await Promise.all(promises);

    let pointTotal = 0;
    for (const { cat, places } of results) {
      for (const p of places) {
        if (usedPlaceIds.has(p.id)) continue;
        usedPlaceIds.add(p.id);

        let minDetour = Infinity;
        let bestSegIdx = 0;
        const poiCoord: [number, number] = [p.location.latitude, p.location.longitude];
        for (let i = 0; i < coords.length - 1; i++) {
          const d = distToSegment(poiCoord, coords[i], coords[i + 1]);
          if (d < minDetour) {
            minDetour = d;
            bestSegIdx = i;
          }
        }

        if (minDetour > maxDetour) continue;

        const progress = bestSegIdx / Math.max(1, coords.length - 1);
        const distFromOrigin = progress * totalDistance;

        allResults.push({
          ...p,
          distFromOrigin,
          detour: minDetour,
          category: cat,
        });
        pointTotal++;
      }
    }

    console.log(
      `📍 [Point @ ${point.progressKm.toFixed(0)}km] (${point.lat.toFixed(2)}, ${point.lng.toFixed(2)}) → ${pointTotal} POIs nuevos`
    );
  }

  console.log(`✅ [POI Search] Total: ${allResults.length} POIs en el corredor`);

  return allResults.sort((a, b) => a.distFromOrigin - b.distFromOrigin);
}

/**
 * Busca POIs cerca de un punto único (para el buscador "Buscar cerca").
 * Más rápido porque solo hace una consulta por categoría.
 */
export async function searchPOIsNearPoint(
  lat: number,
  lng: number,
  activeCategories: Set<string>,
  radius: number = 30000 // 30 km
): Promise<POISuggestion[]> {
  if (activeCategories.size === 0) return [];

  const allResults: POISuggestion[] = [];
  const usedPlaceIds = new Set<string>();

  const promises = Array.from(activeCategories).map(async (cat) => {
    const googleType = CATEGORY_TO_GOOGLE_TYPE[cat];
    const query =
      CATEGORY_QUERIES[cat] ||
      POI_CATEGORIES[cat as keyof typeof POI_CATEGORIES]?.label ||
      cat;

    const places = await searchPlacesNearby(query, {
      lat,
      lng,
      radius,
      types: googleType ? [googleType] : undefined,
      minRating: 4.0,
      strict: true,
    });

    return places.map((p) => ({ p, cat: cat as keyof typeof POI_CATEGORIES }));
  });

  const results = await Promise.all(promises);

  for (const arr of results) {
    for (const { p, cat } of arr) {
      if (usedPlaceIds.has(p.id)) continue;
      usedPlaceIds.add(p.id);

      allResults.push({
        ...p,
        distFromOrigin: 0,
        detour: 0,
        category: cat,
      });
    }
  }

  return allResults;
}
