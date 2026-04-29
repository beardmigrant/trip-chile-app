'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { Moon, Sun, Search, MapPin, Zap, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { ChargingStation, POI } from '@/types';
import stationsData from '@/data/stations.json';
import poisData from '@/data/pois-chile.json';
import { POI_CATEGORIES } from '@/lib/constants';

const MapView = dynamic(() => import('@/components/map/map-view').then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-secondary">
      <div className="text-muted-foreground">Cargando mapa...</div>
    </div>
  ),
});

const STATIONS = stationsData as ChargingStation[];
const POIS = poisData as POI[];

export function TripChileApp() {
  const [showStations, setShowStations] = useState(true);
  const [activePoiCategories, setActivePoiCategories] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const visibleCategories = useMemo(() => activePoiCategories, [activePoiCategories]);

  const toggleCategory = (cat: string) => {
    setActivePoiCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const visibleStations = useMemo(() => {
    if (!showStations) return [];
    return STATIONS;
  }, [showStations]);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-background">
      <MapView
        stations={visibleStations}
        pois={POIS}
        showStations={showStations}
        visiblePoiCategories={visibleCategories}
      />

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
            className="mt-2 flex items-center gap-2 rounded-2xl glass p-2 pl-4 shadow-lg max-w-md"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar ciudad, lugar, cargador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8"
            />
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
              Cargadores {showStations && <Badge variant="primary" className="ml-1">{STATIONS.length}</Badge>}
            </Chip>
            {Object.entries(POI_CATEGORIES).map(([key, cat]) => {
              const active = activePoiCategories.has(key);
              const count = POIS.filter((p) => p.category === key).length;
              return (
                <Chip
                  key={key}
                  active={active}
                  onClick={() => toggleCategory(key)}
                  dotColor={cat.color}
                  icon={cat.icon}
                >
                  {cat.label} {count > 0 && active && <Badge variant="primary" className="ml-1">{count}</Badge>}
                </Chip>
              );
            })}
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-2 safe-bottom">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
        >
          <Button
            size="icon"
            className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-blue-500 shadow-xl shadow-primary/40"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </Button>
        </motion.div>
      </div>

      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ delay: 0.3 }}
          className="absolute bottom-24 left-3 right-3 sm:left-4 sm:right-4 sm:bottom-6 sm:max-w-md z-10 safe-bottom"
        >
          <div className="rounded-2xl glass p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">¡Bienvenido Jesu!</div>
                <div className="text-xs text-muted-foreground">
                  {STATIONS.length} cargadores · {POIS.length} sitios curados
                </div>
              </div>
              <Button size="sm" variant="success" className="text-xs">
                Planificar viaje
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Componente separado con guarda de hidratación para evitar mismatch SSR/Client
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Renderizar un placeholder en SSR para evitar mismatch
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
