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
  onStationClick?: (s: ChargingStation) => void;
  onPoiClick?: (p: POI) => void;
}

const STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

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
  onStationClick,
  onPoiClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const { resolvedTheme } = useTheme();
  const [isReady, setIsReady] = useState(false);

  // Inicializar mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES[resolvedTheme === 'dark' ? 'dark' : 'light'],
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
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

  // Cambiar tema
  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    mapRef.current.setStyle(STYLES[resolvedTheme === 'dark' ? 'dark' : 'light']);
  }, [resolvedTheme, isReady]);

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
  }, [routeGeometry, isReady]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
