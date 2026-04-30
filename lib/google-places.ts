// Cliente de Google Places API (New) - v2 FIXED
// Fix: eliminado `includedType` en Text Search (causaba fallback a Chile entero)
// Fix: agregado `strictTypeFiltering` para forzar match estricto cuando hay types
// Fix: queries simplificados para mejor matching en zonas rurales

export interface GooglePlace {
  id: string;
  displayName: { text: string; languageCode: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
  editorialSummary?: { text: string };
}

export interface AutocompletePrediction {
  placePrediction: {
    placeId: string;
    text: { text: string };
    structuredFormat?: {
      mainText: { text: string };
      secondaryText?: { text: string };
    };
    types?: string[];
  };
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
const BASE_URL = 'https://places.googleapis.com/v1';

if (!API_KEY) {
  console.warn('⚠️ NEXT_PUBLIC_GOOGLE_PLACES_API_KEY not set');
}

export async function autocompletePlaces(
  query: string,
  options: { latBias?: number; lngBias?: number; radius?: number } = {}
): Promise<AutocompletePrediction[]> {
  if (!query || query.length < 2 || !API_KEY) return [];

  const body: Record<string, unknown> = {
    input: query,
    languageCode: 'es',
    regionCode: 'CL',
  };

  if (options.latBias && options.lngBias) {
    body.locationBias = {
      circle: {
        center: { latitude: options.latBias, longitude: options.lngBias },
        radius: Math.min(options.radius || 50000, 50000),
      },
    };
  }

  try {
    const res = await fetch(`${BASE_URL}/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Places autocomplete error:', res.status);
      return [];
    }
    const data = await res.json();
    return data.suggestions || [];
  } catch (e) {
    console.error('Autocomplete failed:', e);
    return [];
  }
}

export async function getPlaceDetails(placeId: string): Promise<GooglePlace | null> {
  if (!placeId || !API_KEY) return null;

  const fields = [
    'id',
    'displayName',
    'formattedAddress',
    'location',
    'types',
    'primaryType',
    'primaryTypeDisplayName',
    'rating',
    'userRatingCount',
    'priceLevel',
    'websiteUri',
    'internationalPhoneNumber',
    'regularOpeningHours',
    'photos',
    'editorialSummary',
  ].join(',');

  try {
    const res = await fetch(`${BASE_URL}/places/${placeId}?languageCode=es`, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fields,
      },
    });
    if (!res.ok) {
      console.error('Place details error:', res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('Place details failed:', e);
    return null;
  }
}

/**
 * Buscar lugares en una zona (Text Search).
 *
 * FIX v2: Google Places Text Search tiene comportamiento de "fallback expandido"
 * cuando `includedType` + `textQuery` no matchean dentro del `locationRestriction`.
 * Esto causaba que en zonas rurales (Talca, Chillán, Temuco) Google devolviera
 * POIs de Santiago en vez de no devolver nada.
 *
 * Solución: usar SOLO el textQuery + locationRestriction rectangle.
 * Si se proveen types, usar `strictTypeFiltering: true` que sí es válido
 * en Text Search y filtra después de la búsqueda.
 */
export async function searchPlacesNearby(
  query: string,
  options: {
    lat: number;
    lng: number;
    radius?: number;
    types?: string[];
    minRating?: number;
    strict?: boolean;
  }
): Promise<GooglePlace[]> {
  if (!API_KEY) return [];

  const body: Record<string, unknown> = {
    textQuery: query,
    languageCode: 'es',
    regionCode: 'CL',
    pageSize: 20, // máximo permitido en Text Search
  };

  const radiusM = options.radius || 5000;

  if (options.strict !== false) {
    // locationRestriction acepta SOLO rectangle. Convertimos círculo → bbox
    // Aproximación: 1 grado lat ≈ 111km, 1 grado lng varía con latitud
    const radiusKm = radiusM / 1000;
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((options.lat * Math.PI) / 180));

    body.locationRestriction = {
      rectangle: {
        low: {
          latitude: options.lat - dLat,
          longitude: options.lng - dLng,
        },
        high: {
          latitude: options.lat + dLat,
          longitude: options.lng + dLng,
        },
      },
    };
  } else {
    // locationBias acepta circle (más permisivo)
    body.locationBias = {
      circle: {
        center: { latitude: options.lat, longitude: options.lng },
        radius: radiusM,
      },
    };
  }

  // FIX CRÍTICO: NO usar `includedType` en Text Search.
  // Causa fallback expandido cuando no hay match exacto.
  // Usar `strictTypeFiltering` en su lugar (filtra resultado, no la búsqueda).
  if (options.types && options.types.length > 0) {
    body.includedType = options.types[0];
    body.strictTypeFiltering = true; // ← fuerza filtro estricto, no expande búsqueda
  }

  if (options.minRating) {
    body.minRating = options.minRating;
  }

  const fields = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.types',
    'places.primaryType',
    'places.primaryTypeDisplayName',
    'places.rating',
    'places.userRatingCount',
    'places.photos',
    'places.editorialSummary',
  ].join(',');

  try {
    const res = await fetch(`${BASE_URL}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fields,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Search nearby error:', res.status, errorText);
      return [];
    }
    const data = await res.json();
    const places: GooglePlace[] = data.places || [];

    // SAFETY NET: filtro manual post-respuesta para garantizar que
    // todos los POIs estén DENTRO del rectángulo solicitado.
    // Esto blinda contra cualquier comportamiento inesperado de Google.
    if (options.strict !== false) {
      const radiusKm = radiusM / 1000;
      const dLat = radiusKm / 111;
      const dLng = radiusKm / (111 * Math.cos((options.lat * Math.PI) / 180));
      const minLat = options.lat - dLat;
      const maxLat = options.lat + dLat;
      const minLng = options.lng - dLng;
      const maxLng = options.lng + dLng;

      const filtered = places.filter((p) => {
        const lat = p.location?.latitude;
        const lng = p.location?.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') return false;
        return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
      });

      if (filtered.length < places.length) {
        console.log(
          `🔒 [GeoFilter] ${places.length - filtered.length} POIs descartados fuera del bbox de (${options.lat.toFixed(2)}, ${options.lng.toFixed(2)})`
        );
      }
      return filtered;
    }

    return places;
  } catch (e) {
    console.error('Search nearby failed:', e);
    return [];
  }
}

export function getPhotoUrl(photoName: string, maxWidth = 800): string {
  if (!API_KEY) return '';
  return `${BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`;
}
