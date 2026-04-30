'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl';
import { useTheme } from 'next-themes';
import type { ChargingStation, POI } from '@/types';
import { OPERATOR_COLORS, OPERATOR_INITIALS, POI_CATEGORIES } from '@/lib/constants';

interface MapViewProps {
  stations: ChargingStation[];
  pois?: POI[];
  showStations?: boolean;
  visiblePoiCategories?: Set<string>;
  highlightedStops?: Set<string>;
  routeGeometry?: { type: 'LineString'; coordinates: [number, number][] };
  origin?: [number, number];
  dest?: [number, number];
  /** Cuando se calcula una ruta, atenuar puntos fuera del corredor */
  dimNonRoutePoints?: boolean;
  /** IDs de stations en el corredor de la ruta (no se atenúan) */
  routeStationIds?: Set<string>;
  /** IDs de POIs en el corredor de la ruta (no se atenúan) */
  routePoiIds?: Set<string>;
  /** Para volar a un punto cuando se busca */
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
  /** Estilo de mapa elegido por el usuario (Voyager / Dark / Satélite / Auto) */
  mapStyleId?: MapStyleId;
  onStationClick?: (s: ChargingStation) => void;
  onPoiClick?: (p: POI) => void;
}

export type MapStyleId = 'auto' | 'voyager' | 'dark' | 'satellite';

export const MAP_STYLE_OPTIONS: Array<{ id: MapStyleId; label: string }> = [
  { id: 'auto', label: 'Auto (según tema)' },
  { id: 'voyager', label: 'Voyager (claro)' },
  { id: 'dark', label: 'Dark Matter (oscuro)' },
  { id: 'satellite', label: 'Satélite' },
];

const STYLES: Record<Exclude<MapStyleId, 'auto'>, maplibregl.StyleSpecification | string> = {
  voyager: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  satellite: {
    version: 8,
    sources: {
      'esri-world-imagery': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Tiles © Esri',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'esri-world-imagery-layer',
        type: 'raster',
        source: 'esri-world-imagery',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  },
};

/** Resuelve el estilo a usar dado el style elegido + theme actual */
function getMaxZoomForStyle(styleId: MapStyleId, themeIsDark: boolean): number {
  const effective = styleId === 'auto' ? (themeIsDark ? 'dark' : 'voyager') : styleId;
  // Satelite tiene cobertura limitada en zonas rurales de Chile
  return effective === 'satellite' ? 16 : 18;
}

function resolveStyle(
  styleId: MapStyleId,
  themeIsDark: boolean
): maplibregl.StyleSpecification | string {
  if (styleId === 'auto') {
    return themeIsDark ? STYLES.dark : STYLES.voyager;
  }
  return STYLES[styleId];
}

const INITIAL_CENTER: [number, number] = [-70.6693, -33.4489];
const INITIAL_ZOOM = 6;

function createStationElement(
  s: ChargingStation,
  isHighlighted: boolean,
  dimmed: boolean
): HTMLElement {
  const color = OPERATOR_COLORS[s.op] || OPERATOR_COLORS.Otro;
  const initials = OPERATOR_INITIALS[s.op] || '?';

  const el = document.createElement('div');
  el.className = 'tc-marker cursor-pointer';
  if (dimmed) el.classList.add('tc-dimmed');

  if (isHighlighted) {
    const size = 44;
    el.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="tc-svg" style="filter: drop-shadow(0 0 8px rgba(16,185,129,.7)) drop-shadow(0 4px 10px rgba(0,0,0,.4)); transition: transform 0.2s ease;">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 4}" fill="url(#g${size})" stroke="#fff" stroke-width="3.5"/>
        <text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="800">⚡</text>
        <defs>
          <linearGradient id="g${size}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10b981"/>
            <stop offset="100%" stop-color="#059669"/>
          </linearGradient>
        </defs>
      </svg>
    `;
  } else {
    const size = s.fast ? 28 : 24;
    const fontSize = size > 26 ? 10 : 9;
    el.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="tc-svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,.4)); transition: transform 0.15s ease;">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="700" stroke="none">${initials}</text>
      </svg>
    `;
  }

  return el;
}

function createPoiElement(p: POI, dimmed: boolean): HTMLElement {
  const cat = POI_CATEGORIES[p.category as keyof typeof POI_CATEGORIES];
  const color = cat?.color || '#64748b';
  const icon = cat?.icon || '📍';

  const el = document.createElement('div');
  el.className = 'tc-marker cursor-pointer';
  if (dimmed) el.classList.add('tc-dimmed');

  const size = 30;
  el.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="tc-svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,.4)); transition: transform 0.15s ease;">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2.5}" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
      <text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="central" font-size="14">${icon}</text>
    </svg>
  `;
  return el;
}

export function MapView({
  stations,
  pois = [],
  showStations = true,
  visiblePoiCategories,
  highlightedStops,
  routeGeometry,
  dimNonRoutePoints = false,
  routeStationIds,
  routePoiIds,
  flyTo,
  mapStyleId = 'auto',
  onStationClick,
  onPoiClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const { resolvedTheme } = useTheme();
  const [isReady, setIsReady] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);

  // Inicializar mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveStyle(mapStyleId, resolvedTheme === 'dark'),
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      maxZoom: getMaxZoomForStyle(mapStyleId, resolvedTheme === 'dark'),
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setIsReady(true));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambiar tema o estilo de mapa
  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;
    const isDark = resolvedTheme === 'dark';
    const newMaxZoom = getMaxZoomForStyle(mapStyleId, isDark);
    map.setMaxZoom(newMaxZoom);
    // Si el zoom actual supera el nuevo max, reducir
    if (map.getZoom() > newMaxZoom) {
      map.setZoom(newMaxZoom);
    }
    map.setStyle(resolveStyle(mapStyleId, isDark));
    // Cuando MapLibre termina de cargar el nuevo estilo, marca un nuevo version
    // para que los useEffect de markers y ruta vuelvan a renderizar
    const onStyleLoad = () => setStyleVersion((v) => v + 1);
    map.once('style.load', onStyleLoad);
    return () => {
      map.off('style.load', onStyleLoad);
    };
  }, [resolvedTheme, isReady, mapStyleId]);

  // FlyTo al buscar
  useEffect(() => {
    if (!mapRef.current || !isReady || !flyTo) return;
    mapRef.current.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom || 12,
      duration: 1500,
    });
  }, [flyTo, isReady]);

  // Renderizar marcadores
  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (showStations) {
      stations.forEach((s) => {
        const key = `${s.lat}_${s.lng}`;
        const isHighlighted = highlightedStops?.has(key) ?? false;
        const dimmed = !!(
          dimNonRoutePoints &&
          !isHighlighted &&
          routeStationIds &&
          !routeStationIds.has(key));
        const el = createStationElement(s, isHighlighted, dimmed);
        // Jerarquía visual: cargadores destacados de la ruta encima de todo
        if (isHighlighted) el.style.zIndex = '30';
        else if (dimmed) el.style.zIndex = '5';
        else el.style.zIndex = '10';
        if (onStationClick) el.addEventListener('click', () => onStationClick(s));
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([s.lng, s.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
    }

    pois.forEach((p) => {
      if (visiblePoiCategories && !visiblePoiCategories.has(p.category)) return;
      const dimmed = !!(
        dimNonRoutePoints && routePoiIds && !routePoiIds.has(p.id));
      const el = createPoiElement(p, dimmed);
      // POIs en corredor: prioridad media. Atenuados: prioridad baja.
      if (dimmed) el.style.zIndex = '5';
      else el.style.zIndex = '15';
      if (onPoiClick) el.addEventListener('click', () => onPoiClick(p));
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [
    stations,
    pois,
    showStations,
    visiblePoiCategories,
    highlightedStops,
    isReady,
    dimNonRoutePoints,
    routeStationIds,
    routePoiIds,
    onStationClick,
    onPoiClick,
    styleVersion,
  ]);

  // Dibujar ruta
  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    const map = mapRef.current;

    if (map.getLayer('route-line')) map.removeLayer('route-line');
    if (map.getLayer('route-outline')) map.removeLayer('route-outline');
    if (map.getSource('route')) map.removeSource('route');

    if (routeGeometry) {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: routeGeometry },
      });
      map.addLayer({
        id: 'route-outline',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.95 },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#0066cc', 'line-width': 5 },
      });

      const coords = routeGeometry.coordinates;
      if (coords.length > 0) {
        const bounds = coords.reduce(
          (b, c) => b.extend([c[0], c[1]] as [number, number]),
          new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
        );
        map.fitBounds(bounds, { padding: { top: 220, bottom: 120, left: 60, right: 60 } });
      }
    }
  }, [routeGeometry, isReady, styleVersion]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
