// Cliente de Google Places API (New)
// Usa REST API directa, no la JS library completa

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
  priceLevel?: 'PRICE_LEVEL_FREE' | 'PRICE_LEVEL_INEXPENSIVE' | 'PRICE_LEVEL_MODERATE' | 'PRICE_LEVEL_EXPENSIVE' | 'PRICE_LEVEL_VERY_EXPENSIVE';
  websiteUri?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  photos?: Array<{
    name: string;
    widthPx: number;
    heightPx: number;
  }>;
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

/**
 * Autocomplete de lugares (búsqueda)
 */
export async function autocompletePlaces(
  query: string,
  options: { latBias?: number; lngBias?: number; radius?: number } = {}
): Promise<AutocompletePrediction[]> {
  if (!query || query.length < 2 || !API_KEY) return [];

  // Body simplificado - sin parámetros que causaban error 400
  const body: Record<string, unknown> = {
    input: query,
    languageCode: 'es',
    regionCode: 'CL',
  };

  // Bias geográfico opcional (centrado en Chile)
  if (options.latBias && options.lngBias) {
    body.locationBias = {
      circle: {
        center: { latitude: options.latBias, longitude: options.lngBias },
        radius: Math.min(options.radius || 50000, 50000), // Max 50km en autocomplete
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
      const errorText = await res.text();
      console.error('Places autocomplete error:', res.status, errorText);
      return [];
    }
    const data = await res.json();
    return data.suggestions || [];
  } catch (e) {
    console.error('Autocomplete failed:', e);
    return [];
  }
}

/**
 * Obtener detalles completos de un lugar por ID
 */
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
      const errorText = await res.text();
      console.error('Place details error:', res.status, errorText);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('Place details failed:', e);
    return null;
  }
}

/**
 * Buscar lugares en una zona (Text Search)
 */
export async function searchPlacesNearby(
  query: string,
  options: {
    lat: number;
    lng: number;
    radius?: number;
    types?: string[];
    minRating?: number;
  }
): Promise<GooglePlace[]> {
  if (!API_KEY) return [];

  const body: Record<string, unknown> = {
    textQuery: query,
    languageCode: 'es',
    regionCode: 'CL',
    locationBias: {
      circle: {
        center: { latitude: options.lat, longitude: options.lng },
        radius: options.radius || 5000,
      },
    },
  };

  if (options.types && options.types.length > 0) {
    body.includedType = options.types[0];
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
    return data.places || [];
  } catch (e) {
    console.error('Search nearby failed:', e);
    return [];
  }
}

/**
 * Generar URL de foto desde el "name" de la photo reference de Google
 */
export function getPhotoUrl(photoName: string, maxWidth = 800): string {
  if (!API_KEY) return '';
  return `${BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`;
}
