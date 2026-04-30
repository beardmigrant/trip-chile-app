'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { Moon, Sun, Zap, Compass, Route as RouteIcon, Star } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/layout/search-bar';
import {
  ChargerFilterPopover,
  DEFAULT_CHARGER_FILTERS,
  type ChargerFilters,
} from '@/components/layout/charger-filter-popover';
import { StationDetail } from '@/components/trip/station-detail';
import { PlaceDetail } from '@/components/poi/place-detail';
import { TripPlanner } from '@/components/trip/trip-planner';
import { TripResult } from '@/components/trip/trip-result';
import { SavedRoutesSheet } from '@/components/trip/saved-routes-sheet';
import { saveRoute, suggestRouteName, type SavedRoute } from '@/lib/saved-routes';
import type { ChargingStation, POI, TripLocation } from '@/types';
import stationsData from '@/data/stations.json';
import { POI_CATEGORIES } from '@/lib/constants';
import { searchPlacesNearby, type GooglePlace } from '@/lib/google-places';
import type { TripCalcResult } from '@/lib/charging';
import { distToSegment } from '@/lib/utils';
import {
  searchPOIsAlongRoute,
  searchPOIsNearPoint,
  type POISuggestion,
} from '@/lib/poi-search';

const MapView = dynamic(() => import('@/components/map/map-view').then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-secondary">
      <div className="text-muted-foreground">Cargando mapa...</div>
    </div>
  ),
});

const STATIONS = stationsData as ChargingStation[];


export function TripChileApp() {
  const [showStations, setShowStations] = useState(true);
  const [chargerFilters, setChargerFilters] = useState<ChargerFilters>(
    DEFAULT_CHARGER_FILTERS
  );
  const [activePoiCategories, setActivePoiCategories] = useState<Set<string>>(new Set());
  const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [stationDetailOpen, setStationDetailOpen] = useState(false);
  const [placeDetailOpen, setPlaceDetailOpen] = useState(false);
  const [searchedPois, setSearchedPois] = useState<GooglePlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(
    null
  );

  // Trip state
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [tripResult, setTripResult] = useState<TripCalcResult | null>(null);
  const [tripOrigin, setTripOrigin] = useState<TripLocation | null>(null);
  const [tripDest, setTripDest] = useState<TripLocation | null>(null);
  const [tripStartSoC, setTripStartSoC] = useState(90);
  const [tripEndSoC, setTripEndSoC] = useState(50);
  const [tripSafetyBuffer, setTripSafetyBuffer] = useState(30);
  const [tripResultOpen, setTripResultOpen] = useState(false);
  const [savedRoutesOpen, setSavedRoutesOpen] = useState(false);

  // POIs en ruta
  const [addedPOIs, setAddedPOIs] = useState<Map<string, POISuggestion>>(new Map());
  const [skippedPOIs, setSkippedPOIs] = useState<Set<string>>(new Set());
  const [routePois, setRoutePois] = useState<POISuggestion[]>([]);

  // Auto-cargar POIs del corredor cuando hay ruta + categorías activas
  useEffect(() => {
    if (!tripResult?.routeGeometry || activePoiCategories.size === 0) {
      setRoutePois([]);
      return;
    }
    let cancelled = false;
    searchPOIsAlongRoute(
      tripResult.routeGeometry,
      tripResult.distance,
      activePoiCategories,
      15
    ).then((pois) => {
      if (cancelled) return;
      setRoutePois(pois);
      console.log(
        `✓ [DEBUG] ${pois.length} POIs en corredor`,
        pois.slice(0, 3).map((p) => ({
          name: p.displayName?.text,
          lat: p.location?.latitude,
          lng: p.location?.longitude,
          category: p.category,
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [tripResult, activePoiCategories]);

  // Mapeo helper: ¿una station pasa los filtros activos?
  const stationPassesFilters = useCallback(
    (s: ChargingStation): boolean => {
      if (!chargerFilters.operators.has(s.op)) return false;
      if (!chargerFilters.types.has(s.tc)) return false;
      if (chargerFilters.teslaOnly && !s.tcomp) return false;

      const speed: 'ultra' | 'fast' | 'slow' =
        s.pc >= 150 ? 'ultra' : s.pc >= 50 ? 'fast' : 'slow';
      if (!chargerFilters.speeds.has(speed)) return false;

      return true;
    },
    [chargerFilters]
  );

  // Cargadores que pasan el filtro (sobre todos)
  const filteredStations = useMemo(
    () => STATIONS.filter(stationPassesFilters),
    [stationPassesFilters]
  );

  // IDs de stations dentro del corredor (para no atenuar)
  const routeStationIds = useMemo(() => {
    if (!tripResult?.routeGeometry) return new Set<string>();

    const coords = tripResult.routeGeometry.coordinates.map(
      (c) => [c[1], c[0]] as [number, number]
    );
    if (coords.length < 2) return new Set<string>();

    const MAX_DETOUR_KM = 15;
    const ids = new Set<string>();
    const step = Math.max(1, Math.floor(coords.length / 50));

    for (const s of filteredStations) {
      let minDetour = Infinity;
      const stCoord: [number, number] = [s.lat, s.lng];
      for (let i = 0; i < coords.length - 1; i += step) {
        const d = distToSegment(stCoord, coords[i], coords[i + 1]);
        if (d < minDetour) minDetour = d;
        if (minDetour <= MAX_DETOUR_KM) break;
      }
      if (minDetour <= MAX_DETOUR_KM) {
        ids.add(`${s.lat}_${s.lng}`);
      }
    }
    return ids;
  }, [filteredStations, tripResult]);

  // Stations visibles en el mapa (con filtros aplicados)
  const visibleStations = useMemo(() => {
    if (!showStations) return [];
    return filteredStations;
  }, [showStations, filteredStations]);

  // Conteo para mostrar en el pill: cuántos están visibles realmente
  const stationsVisibleCount = useMemo(() => {
    if (!showStations) return 0;
    if (tripResult) return routeStationIds.size; // solo los del corredor
    return filteredStations.length;
  }, [showStations, tripResult, routeStationIds, filteredStations]);

  // POIs visibles
  const visiblePois = useMemo<POI[]>(() => {
    const fromSearch = searchedPois.map((g) => ({
      id: g.id,
      name: g.displayName.text,
      category: detectCategory(g.types || []),
      lat: g.location.latitude,
      lng: g.location.longitude,
      rating: g.rating,
      address: g.formattedAddress,
    }));
    const fromAdded = Array.from(addedPOIs.values()).map((g) => ({
      id: g.id,
      name: g.displayName.text,
      category: g.category as POI['category'],
      lat: g.location.latitude,
      lng: g.location.longitude,
      rating: g.rating,
      address: g.formattedAddress,
    }));
    const fromRoute = routePois.map((g) => ({
      id: g.id,
      name: g.displayName.text,
      category: g.category as POI['category'],
      lat: g.location.latitude,
      lng: g.location.longitude,
      rating: g.rating,
      address: g.formattedAddress,
    }));
    const map = new Map<string, POI>();
    [...fromSearch, ...fromAdded, ...fromRoute].forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [searchedPois, addedPOIs, routePois]);

  // POIs que están en el corredor (no se atenúan)
  const routePoiIds = useMemo(() => {
    return new Set(routePois.map((p) => p.id));
  }, [routePois]);

  const highlightedStops = useMemo(() => {
    if (!tripResult) return new Set<string>();
    return new Set(tripResult.suggestedStops.map((s) => `${s.lat}_${s.lng}`));
  }, [tripResult]);

  const toggleCategory = (cat: string) => {
    setActivePoiCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleStationClick = useCallback((s: ChargingStation) => {
    setSelectedStation(s);
    setStationDetailOpen(true);
  }, []);

  const handlePoiClick = useCallback((p: POI) => {
    setSelectedPlaceId(p.id);
    setPlaceDetailOpen(true);
  }, []);

  // Buscador: abrir ficha + volar mapa + buscar POIs cercanos
  const handleSelectPlace = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
    setPlaceDetailOpen(true);
  }, []);

  const handleSelectLocation = useCallback(
    async (loc: { lat: number; lng: number; name: string }) => {
      // Volar mapa
      setFlyTo({ lat: loc.lat, lng: loc.lng, zoom: 12 });

      // Buscar POIs cerca según categorías activas
      if (activePoiCategories.size > 0) {
        setSearching(true);
        const results = await searchPOIsNearPoint(
          loc.lat,
          loc.lng,
          activePoiCategories,
          15000
        );
        setSearchedPois(results);
        setSearching(false);
      }
    },
    [activePoiCategories]
  );

  const handleSearchNearby = async (lat: number, lng: number) => {
    if (activePoiCategories.size === 0) {
      alert('Activa al menos una categoría antes de buscar cerca.');
      return;
    }
    setSearching(true);
    const results = await searchPOIsNearPoint(
      lat,
      lng,
      activePoiCategories,
      30000
    );
    setSearchedPois(results);
    setSearching(false);
    if (results.length === 0) {
      alert('No se encontraron lugares cercanos para las categorías seleccionadas.');
    }
  };

  const handleTripCalculated = (
    result: TripCalcResult,
    origin: TripLocation,
    dest: TripLocation,
    settings: { startSoC: number; endSoC: number; safetyBuffer: number }
  ) => {
    setTripResult(result);
    setTripOrigin(origin);
    setTripDest(dest);
    setTripStartSoC(settings.startSoC);
    setTripEndSoC(settings.endSoC);
    setTripSafetyBuffer(settings.safetyBuffer);
    setAddedPOIs(new Map());
    setSkippedPOIs(new Set());
    setTripResultOpen(true);
  };

  const handleClearTrip = () => {
    setTripResult(null);
    setTripOrigin(null);
    setTripDest(null);
    setAddedPOIs(new Map());
    setSkippedPOIs(new Set());
    setRoutePois([]);
    setTripResultOpen(false);
  };


  const handleSaveCurrentRoute = useCallback(() => {
    if (!tripOrigin || !tripDest) return;
    const defaultName = suggestRouteName(tripOrigin, tripDest);
    const name = prompt('Nombre de la ruta:', defaultName)?.trim();
    if (!name) return;
    try {
      saveRoute({
        name,
        origin: tripOrigin,
        destination: tripDest,
        startSoC: tripStartSoC,
        endSoC: tripEndSoC,
        safetyBuffer: tripSafetyBuffer,
        activeCategories: Array.from(activePoiCategories),
      });
      alert(`✓ Ruta "${name}" guardada`);
    } catch (e) {
      alert(`Error al guardar: ${e instanceof Error ? e.message : 'desconocido'}`);
    }
  }, [tripOrigin, tripDest, tripStartSoC, tripEndSoC, tripSafetyBuffer, activePoiCategories]);

  const handleLoadRoute = useCallback((route: SavedRoute) => {
    setTripOrigin(route.origin);
    setTripDest(route.destination);
    setTripStartSoC(route.startSoC);
    setTripEndSoC(route.endSoC);
    setTripSafetyBuffer(route.safetyBuffer);
    setActivePoiCategories(new Set(route.activeCategories));
    setTripResult(null);
    setAddedPOIs(new Map());
    setSkippedPOIs(new Set());
    setRoutePois([]);
    setTripResultOpen(false);
    setPlannerOpen(true);
  }, []);

  const handleAddPOI = useCallback((poi: POISuggestion) => {
    setAddedPOIs((prev) => {
      const next = new Map(prev);
      next.set(poi.id, poi);
      return next;
    });
    setSkippedPOIs((prev) => {
      const next = new Set(prev);
      next.delete(poi.id);
      return next;
    });
  }, []);

  const handleSkipPOI = useCallback((poiId: string) => {
    setAddedPOIs((prev) => {
      const next = new Map(prev);
      next.delete(poiId);
      return next;
    });
    setSkippedPOIs((prev) => {
      const next = new Set(prev);
      next.add(poiId);
      return next;
    });
  }, []);

  const handleViewPOI = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
    setPlaceDetailOpen(true);
  }, []);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-background">
      <MapView
        stations={visibleStations}
        pois={visiblePois}
        showStations={showStations}
        visiblePoiCategories={activePoiCategories}
        highlightedStops={highlightedStops}
        routeGeometry={tripResult?.routeGeometry}
        dimNonRoutePoints={!!tripResult}
        routeStationIds={routeStationIds}
        routePoiIds={routePoiIds}
        flyTo={flyTo}
        onStationClick={handleStationClick}
        onPoiClick={handlePoiClick}
      />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 safe-top">
        <div className="px-3 pt-3 pointer-events-auto">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-3 rounded-2xl glass p-3 shadow-lg max-w-md"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-blue-500 text-white shadow-md shadow-primary/30">
              <Zap className="h-4 w-4" fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm tracking-tight">TripChile</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                EV · Tesla Model Y
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSavedRoutesOpen(true)} aria-label="Rutas guardadas">
              <Star className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </motion.div>

          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mt-2"
          >
            <SearchBar
              onSelectPlace={handleSelectPlace}
              onSelectLocation={handleSelectLocation}
            />
          </motion.div>

          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar"
          >
            <ChargerFilterPopover
              active={showStations}
              count={stationsVisibleCount}
              totalCount={STATIONS.length}
              filters={chargerFilters}
              onActiveChange={setShowStations}
              onFiltersChange={setChargerFilters}
            />
            {Object.entries(POI_CATEGORIES).map(([key, cat]) => {
              const active = activePoiCategories.has(key);
              return (
                <Chip
                  key={key}
                  active={active}
                  onClick={() => toggleCategory(key)}
                  dotColor={cat.color}
                  icon={cat.icon}
                >
                  {cat.label}
                </Chip>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* FABs */}
      <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-2 safe-bottom">
        {tripResult && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring' }}
          >
            <Button
              size="icon"
              variant="success"
              onClick={() => setTripResultOpen(true)}
              className="h-12 w-12 rounded-2xl shadow-lg shadow-emerald-500/30"
              title="Ver mi ruta"
            >
              <RouteIcon className="h-5 w-5" />
            </Button>
          </motion.div>
        )}

        {activePoiCategories.size > 0 && !tripResult && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring' }}
          >
            <Button
              size="icon"
              variant="secondary"
              onClick={() => handleSearchNearby(-33.4489, -70.6693)}
              disabled={searching}
              className="h-12 w-12 rounded-2xl shadow-lg"
              title="Buscar lugares cerca"
            >
              <Compass className={`h-5 w-5 ${searching ? 'animate-spin' : ''}`} />
            </Button>
          </motion.div>
        )}

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
        >
          <Button
            size="icon"
            onClick={() => setPlannerOpen(true)}
            className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-blue-500 shadow-xl shadow-primary/40"
            title="Planificar viaje"
          >
            <Zap className="h-6 w-6" fill="currentColor" strokeWidth={2.5} />
          </Button>
        </motion.div>
      </div>

      {/* Sheets */}
      <StationDetail
        station={selectedStation}
        open={stationDetailOpen}
        onOpenChange={setStationDetailOpen}
      />
      <PlaceDetail
        placeId={selectedPlaceId}
        open={placeDetailOpen}
        onOpenChange={setPlaceDetailOpen}
      />
      <TripPlanner
        open={plannerOpen}
        onOpenChange={setPlannerOpen}
        stations={STATIONS}
        onTripCalculated={handleTripCalculated}
      />
      <TripResult
        result={tripResult}
        origin={tripOrigin}
        dest={tripDest}
        startSoC={tripStartSoC}
        endSoC={tripEndSoC}
        safetyBuffer={tripSafetyBuffer}
        open={tripResultOpen}
        onOpenChange={setTripResultOpen}
        onClear={handleClearTrip}
        onSaveRoute={handleSaveCurrentRoute}
        onStationClick={handleStationClick}
        activePoiCategories={activePoiCategories}
        addedPOIs={addedPOIs}
        skippedPOIs={skippedPOIs}
        onAddPOI={handleAddPOI}
        onSkipPOI={handleSkipPOI}
        onViewPOI={handleViewPOI}
      />
      <SavedRoutesSheet open={savedRoutesOpen} onOpenChange={setSavedRoutesOpen} onLoadRoute={handleLoadRoute} />
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
        <div className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="h-9 w-9"
      aria-label="Cambiar tema"
    >
      {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  dotColor?: string;
  icon?: string;
  children: React.ReactNode;
}

function Chip({ active, onClick, dotColor, icon, children }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all active:scale-95 shadow-md ${
        active
          ? 'bg-primary text-primary-foreground shadow-primary/40'
          : 'glass hover:bg-card/95'
      }`}
    >
      {icon && <span className="text-sm">{icon}</span>}
      {!icon && dotColor && (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: active ? 'currentColor' : dotColor }}
        />
      )}
      <span>{children}</span>
    </button>
  );
}

function detectCategory(types: string[]): POI['category'] {
  for (const t of types) {
    if (
      ['lodging', 'hotel', 'campground', 'rv_park', 'guest_house'].includes(t)
    )
      return 'lodging';
    if (
      ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway', 'meal_delivery', 'food'].includes(t)
    )
      return 'food';
    if (
      [
        'museum',
        'art_gallery',
        'church',
        'mosque',
        'hindu_temple',
        'synagogue',
        'cemetery',
        'library',
        'monument',
        'historical_landmark',
      ].includes(t)
    )
      return 'historic';
    if (['planetarium'].includes(t)) return 'astro';
    if (
      [
        'amusement_park',
        'zoo',
        'aquarium',
        'casino',
        'movie_theater',
        'bowling_alley',
        'stadium',
        'spa',
        'gym',
        'night_club',
      ].includes(t)
    )
      return 'recreation';
    if (['park', 'national_park', 'natural_feature'].includes(t)) return 'nature';
    if (['gas_station', 'supermarket', 'pharmacy', 'convenience_store', 'atm', 'parking'].includes(t))
      return 'services';
  }
  return 'attraction';
}
