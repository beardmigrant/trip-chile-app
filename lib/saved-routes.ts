// ============== STORAGE DE RUTAS GUARDADAS ==============
// Persiste rutas favoritas en localStorage con shape mínimo serializable.
// Las rutas se recalculan al cargar (origin + destination + sliders + mode).

import type { TripLocation } from '@/types';

const STORAGE_KEY = 'tripchile:saved-routes:v1';

export interface SavedRoute {
  id: string;
  name: string;
  origin: TripLocation;
  destination: TripLocation;
  startSoC: number;
  endSoC: number;
  safetyBuffer: number;
  activeCategories: string[]; // Set serializado como array
  savedAt: number; // timestamp
}

/**
 * Lee todas las rutas guardadas desde localStorage.
 * Retorna [] si no hay rutas o si hay error de parsing.
 */
export function getSavedRoutes(): SavedRoute[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.savedAt - a.savedAt); // más reciente primero
  } catch (e) {
    console.error('Failed to read saved routes:', e);
    return [];
  }
}

/**
 * Guarda una nueva ruta. Genera ID único basado en timestamp.
 * Si ya existe una ruta con el mismo nombre, la sobrescribe.
 */
export function saveRoute(
  data: Omit<SavedRoute, 'id' | 'savedAt'>
): SavedRoute {
  const routes = getSavedRoutes();
  const existing = routes.find((r) => r.name === data.name);
  const newRoute: SavedRoute = {
    ...data,
    id: existing?.id || `route_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
  };
  const filtered = routes.filter((r) => r.name !== data.name);
  const updated = [newRoute, ...filtered];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newRoute;
}

/**
 * Elimina una ruta por ID.
 */
export function deleteRoute(id: string): void {
  const routes = getSavedRoutes();
  const filtered = routes.filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Renombra una ruta existente. Si el nuevo nombre ya existe en otra ruta,
 * lanza error (evita duplicados).
 */
export function renameRoute(id: string, newName: string): void {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('El nombre no puede estar vacío');

  const routes = getSavedRoutes();
  const conflict = routes.find((r) => r.id !== id && r.name === trimmed);
  if (conflict) throw new Error('Ya existe una ruta con ese nombre');

  const updated = routes.map((r) =>
    r.id === id ? { ...r, name: trimmed } : r
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Helper: genera un nombre por defecto basado en origen y destino.
 * Ej: "Santiago → Lican Ray"
 */
export function suggestRouteName(
  origin: TripLocation,
  destination: TripLocation
): string {
  const o = origin.name.split(',')[0].trim();
  const d = destination.name.split(',')[0].trim();
  return `${o} → ${d}`;
}
