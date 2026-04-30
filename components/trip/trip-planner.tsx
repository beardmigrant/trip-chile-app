'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Segmented } from '@/components/ui/segmented';
import { PlaceSearchInput } from '@/components/trip/place-search-input';
import { Battery, Info, Calculator, Loader2 } from 'lucide-react';
import type { ChargingStation, OSRMRoute, TripLocation } from '@/types';
import { fetchOSRMRoute } from '@/lib/routing';
import { calculateTrip, type TripCalcResult } from '@/lib/charging';


interface TripPlannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stations: ChargingStation[];
  onTripCalculated: (
    result: TripCalcResult,
    origin: TripLocation,
    dest: TripLocation,
    settings: { startSoC: number; endSoC: number; safetyBuffer: number }
  ) => void;
}

const SAFETY_MODES = {
  minimal: { label: 'Mínimo', sublabel: '10%', value: 10 },
  normal: { label: 'Normal', sublabel: '20%', value: 20 },
  safe: { label: 'Seguro', sublabel: '30%', value: 30 },
  extreme: { label: 'Extremo', sublabel: '40%', value: 40 },
};

export function TripPlanner({ open, onOpenChange, stations, onTripCalculated }: TripPlannerProps) {
  const [origin, setOrigin] = useState<TripLocation | null>(null);
  const [dest, setDest] = useState<TripLocation | null>(null);
  const [startSoC, setStartSoC] = useState(90);
  const [endSoC, setEndSoC] = useState(50);
  const [safetyMode, setSafetyMode] = useState<keyof typeof SAFETY_MODES>('safe');
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safetyBuffer = SAFETY_MODES[safetyMode].value;

  const canCalculate = origin && dest && !calculating;

  const handleCalculate = async () => {
    if (!origin || !dest) return;

    setCalculating(true);
    setError(null);

    try {
      // 1. Fetch ruta real desde OSRM
      const route = await fetchOSRMRoute(
        [origin.lat, origin.lng],
        [dest.lat, dest.lng]
      );

      if (!route) {
        setError(
          'No se pudo calcular la ruta. Servidores OSRM saturados. Intenta de nuevo en 30 segundos.'
        );
        setCalculating(false);
        return;
      }

      // 2. Calcular paradas con la lógica validada
      const result = calculateTrip({
        origin: [origin.lat, origin.lng],
        dest: [dest.lat, dest.lng],
        startSoC,
        endSoC,
        safetyBuffer,
        routeGeometry: route.geometry,
        candidates: stations,
      });

      // 3. Notificar al padre y cerrar
      onTripCalculated(result, origin, dest, {
        startSoC,
        endSoC,
        safetyBuffer,
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setError('Error al calcular la ruta. Reintenta.');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="px-0 max-h-[92dvh]">
        <SheetHeader className="px-5 pt-2 pb-3">
          <SheetTitle className="text-lg">🚗 Planificar viaje</SheetTitle>
          <SheetDescription className="text-xs">
            Crea tu ruta con paradas de carga inteligentes
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 pb-6 space-y-5">
          {/* Origen / Destino */}
          <div className="space-y-3">
            <PlaceSearchInput
              label="Origen"
              placeholder="¿Desde dónde sales?"
              value={origin}
              onChange={setOrigin}
              showLocation
            />
            <PlaceSearchInput
              label="Destino"
              placeholder="¿Adónde vas?"
              value={dest}
              onChange={setDest}
            />
          </div>

          {/* Sliders SoC */}
          <div className="space-y-5 rounded-2xl bg-muted/50 border border-border/50 p-4">
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label className="text-sm font-semibold">
                  Al iniciar el viaje, la carga de batería va a ser del:
                </label>
              </div>
              <Slider
                value={[startSoC]}
                onValueChange={(v) => setStartSoC(v[0])}
                min={20}
                max={100}
                step={5}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label className="text-sm font-semibold">
                  Al llegar al destino, la carga tiene que ser mayor al:
                </label>
              </div>
              <Slider
                value={[endSoC]}
                onValueChange={(v) => setEndSoC(v[0])}
                min={5}
                max={80}
                step={5}
              />
            </div>
          </div>

          {/* Modo de seguridad */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <label className="text-sm font-semibold">🛡️ Modo de seguridad entre paradas</label>
            </div>
            <Segmented
              value={safetyMode}
              onValueChange={(v) => setSafetyMode(v as keyof typeof SAFETY_MODES)}
              options={Object.entries(SAFETY_MODES).map(([key, mode]) => ({
                value: key,
                label: mode.label,
                sublabel: mode.sublabel,
              }))}
            />
            <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground bg-primary/5 rounded-lg p-2.5 border border-primary/10">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
              <div>
                Un margen mayor = más paradas pero menos riesgo si un cargador no funciona o está
                ocupado. <b>Recomendado: Seguro (30%)</b> para sur de Chile.
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Botón calcular */}
          <Button
            onClick={handleCalculate}
            disabled={!canCalculate}
            size="lg"
            className="w-full gap-2"
          >
            {calculating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Calculando ruta real...
              </>
            ) : (
              <>
                <Calculator className="h-5 w-5" />
                Calcular ruta
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <Battery className="h-3 w-3" />
            <span>Tesla Model Y RWD Juniper · 60 kWh · 17.5 kWh/100km</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
