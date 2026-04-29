'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { Moon, Sun, Zap, Plus, Compass, Route as RouteIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/layout/search-bar';
import { StationDetail } from '@/components/trip/station-detail';
import { PlaceDetail } from '@/components/poi/place-detail';
import { TripPlanner } from '@/components/trip/trip-planner';
import { TripResult } from '@/components/trip/trip-result';
import type { ChargingStation, POI, OSRMRoute } from '@/types';
import stationsData from '@/data/stations.json';
import { POI_CATEGORIES } from '@/lib/constants';
import { searchPlacesNearby, type GooglePlace } from '@/lib/google-places';
import type { TripCalcResult } from '@/lib/charging';

const MapView = dynamic(() => import('@/components/map/map-view').then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-secondary">
      <div className="text-muted-foreground">Cargando mapa...</div>
    </div>
  ),
});

const STATIONS = stationsData as ChargingStation[];

const CATEGORY_TO_GOOGLE_TYPES: Record<string, string[]> = {
  historic: ['museum', 'tourist_attraction', 'church'],
  attraction: ['tourist_attraction', 'point_of_interest'],
  recreation: ['amusement_park', 'zoo', 'aquarium', 'casino'],
  astro: ['observatory', 'planetarium'],
  nature: ['park', 'national_park'],
};

interface TripLocation {
  name: string;
  lat: number;
  lng: number;
}

export function TripChileApp() {
  const [showStations, setShowStations] = useState(true);
  const [activePoiCategories, setActivePoiCategories] = useState<Set<string>>(new Set());
  const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [stationDetailOpen, setStationDetailOpen] = useState(false);
  const [placeDetailOpen, setPlaceDetailOpen] = useState(false);
  const [searchedPois, setSearchedPois] = useState<GooglePlace[]>([]);
  const [searching, setSearching] = useState(false);

  // Trip state
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [tripResult, setTripResult] = useState<TripCalcResult | null>(null);
  const [tripOrigin, setTripOrigin] = useState<TripLocation | null>(null);
  const [tripDest, setTripDest] = useState<TripLocation | null>(null);
  const [tripStartSoC, setTripStartSoC] = useState(90);
  const [tripEndSoC, setTripEndSoC] = useState(50);
  const [tripSafetyBuffer, setTripSafetyBuffer] = useState(30);
  const [tripResultOpen, setTripResultOpen] = useState(false);

  const visiblePois = useMemo<POI[]>(() => {
    return searchedPois.map((g) => ({
      id: g.id,
      name: g.displayName.text,
      category: detectCategory(g.types || []),
      lat: g.location.latitude,
      lng: g.location.longitude,
      rating: g.rating,
      address: g.formattedAddress,
    }));
  }, [searchedPois]);

  const visibleStations = useMemo(() => (showStations ? STATIONS : []), [showStations]);

  // Highlighted stops para el mapa: las paradas sugeridas del viaje
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

  const handleSelectPlace = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
    setPlaceDetailOpen(true);
  }, []);

  const handleSearchNearby = async (lat: number, lng: number) => {
    if (activePoiCategories.size === 0) {
      alert('Activa al menos una categoría antes de buscar cerca.');
      return;
    }

    setSearching(true);
    const allResults: GooglePlace[] = [];

    for (const cat of activePoiCategories) {
      const googleTypes = CATEGORY_TO_GOOGLE_TYPES[cat] || [];
      for (const type of googleTypes.slice(0, 1)) {
        const results = await searchPlacesNearby(
          POI_CATEGORIES[cat as keyof typeof POI_CATEGORIES].label,
          { lat, lng, radius: 30000, types: [type], minRating: 4.0 }
        );
        allResults.push(...results);
      }
    }

    const unique = Array.from(new Map(allResults.map((p) => [p.id, p])).values());
    setSearchedPois(unique);
    setSearching(false);

    if (unique.length === 0) {
      alert('No se encontraron lugares cercanos para las categorías seleccionadas.');
    }
  };

  const handleTripCalculated = (
    result: TripCalcResult,
    origin: TripLocation,
    dest: TripLocation
  ) => {
    setTripResult(result);
    setTripOrigin(origin);
    setTripDest(dest);
    setTripResultOpen(true);
  };

  const handleClearTrip = () => {
    setTripResult(null);
    setTripOrigin(null);
    setTripDest(null);
    setTripResultOpen(false);
  };

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-background">
      <MapView
        stations={visibleStations}
        pois={visiblePois}
        showStations={showStations}
        visiblePoiCategories={activePoiCategories}
        highlightedStops={highlightedStops}
        routeGeometry={tripResult?.routeGeometry}
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
            <ThemeToggle />
          </motion.div>

          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mt-2"
          >
            <SearchBar onSelectPlace={handleSelectPlace} />
          </motion.div>

          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar"
          >
            <Chip
              active={showStations}
              onClick={() => setShowStations(!showStations)}
              dotColor="#0066CC"
              icon="⚡"
            >
              Cargadores{' '}
              {showStations && (
                <Badge variant="primary" className="ml-1">
                  {STATIONS.length}
                </Badge>
              )}
            </Chip>
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
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </Button>
        </motion.div>
      </div>

      {/* Welcome card */}
      {!tripResult && searchedPois.length === 0 && activePoiCategories.size === 0 && (
        <AnimatePresence>
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute bottom-24 left-3 right-3 sm:left-4 sm:right-4 sm:bottom-6 sm:max-w-md z-10 safe-bottom pointer-events-none"
          >
            <div className="rounded-2xl glass p-4 shadow-xl pointer-events-auto">
              <div className="text-sm">
                <div className="font-bold mb-1">¡Bienvenido Jesu! 👋</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {STATIONS.length} cargadores en el mapa · Toca el botón <b>⚡+</b> para
                  planificar tu viaje · Activa categorías arriba para buscar lugares
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

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
        onOpenChange={(open) => {
          setPlannerOpen(open);
          // Si cierra el planner sin calcular, no pasa nada
        }}
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
        onStationClick={handleStationClick}
      />
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
    if (['museum', 'church', 'monument', 'historical_landmark'].includes(t)) return 'historic';
    if (['observatory', 'planetarium'].includes(t)) return 'astro';
    if (['amusement_park', 'zoo', 'aquarium', 'casino'].includes(t)) return 'recreation';
    if (['park', 'national_park', 'natural_feature'].includes(t)) return 'nature';
  }
  return 'attraction';
}
