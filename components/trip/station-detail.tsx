'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Zap, Battery, Plug, MapPin, Navigation, ExternalLink, Clock, DollarSign,
} from 'lucide-react';
import type { ChargingStation } from '@/types';
import { OPERATOR_COLORS, OPERATOR_INITIALS, TESLA_MODEL_Y_JUNIPER, COSTS } from '@/lib/constants';
import { estimateChargeTime } from '@/lib/charging';
import { formatCLP, formatDuration } from '@/lib/utils';

interface StationDetailProps {
  station: ChargingStation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToRoute?: (station: ChargingStation) => void;
}

export function StationDetail({ station, open, onOpenChange, onAddToRoute }: StationDetailProps) {
  if (!station) return null;

  const color = OPERATOR_COLORS[station.op] || OPERATOR_COLORS.Otro;
  const initials = OPERATOR_INITIALS[station.op] || '?';
  const isTeslaCompatible = station.tcomp;

  const energyToAdd = TESLA_MODEL_Y_JUNIPER.battery * 0.5;
  const chargeTimeMin = estimateChargeTime(station.pc, energyToAdd);
  const sessionCost = energyToAdd * COSTS.electricityDC;

  const handleOpenInGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${station.lat},${station.lng}`;
    window.open(url, '_blank');
  };

  const handleShareToCar = async () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${station.lat},${station.lng}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: station.n, url });
      } catch (e) {}
    } else {
      navigator.clipboard?.writeText(url);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="px-0">
        <SheetHeader className="px-5 pt-2 pb-4">
          <div className="flex items-start gap-3">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white font-bold shadow-lg"
              style={{ background: color }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base">{station.n}</SheetTitle>
              <SheetDescription className="sr-only">
                Detalles del cargador {station.n}
              </SheetDescription>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {station.d}, {station.c}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge
                  variant={station.tc === 'DC' ? 'success' : 'default'}
                  className="text-[10px]"
                >
                  {station.tc}
                </Badge>
                {station.fast && (
                  <Badge variant="warning" className="text-[10px]">
                    ⚡ Rápida
                  </Badge>
                )}
                {isTeslaCompatible && (
                  <Badge variant="primary" className="text-[10px]">
                    ✓ Tesla
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="px-5 pb-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              label="Potencia"
              value={`${station.pc} kW`}
              sublabel={`Estación: ${station.pe} kW`}
            />
            <StatCard
              icon={<Plug className="h-4 w-4" />}
              label="Conectores"
              value={`${station.nc}`}
              sublabel={station.co.join(', ')}
            />
            {isTeslaCompatible && station.tc === 'DC' && (
              <>
                <StatCard
                  icon={<Clock className="h-4 w-4" />}
                  label="Carga 30→80%"
                  value={formatDuration(chargeTimeMin)}
                  sublabel="Tu Tesla Model Y"
                />
                <StatCard
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Costo sesión"
                  value={formatCLP(sessionCost)}
                  sublabel="Estimado"
                />
              </>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">
              🔌 Conectores disponibles
            </div>
            <div className="flex flex-wrap gap-2">
              {station.co.map((c) => {
                const compat = ['CCS2', 'Tipo 2'].includes(c);
                return (
                  <span
                    key={c}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                      compat
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}
                  >
                    {c} {compat && '✓'}
                  </span>
                );
              })}
            </div>
            {!isTeslaCompatible && (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg p-2.5 border border-amber-500/30">
                ⚠️ Sin conectores compatibles con tu Tesla Model Y (necesita CCS2 o Tipo 2)
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={handleOpenInGoogleMaps} className="gap-2">
              <Navigation className="h-4 w-4" />
              Maps
            </Button>
            <Button onClick={handleShareToCar} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Compartir
            </Button>
          </div>

          {onAddToRoute && (
            <Button
              variant="success"
              onClick={() => onAddToRoute(station)}
              className="w-full gap-2"
            >
              <Battery className="h-4 w-4" />
              Agregar a mi ruta
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3 border border-border/50">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">
        {icon}
        {label}
      </div>
      <div className="font-bold text-base mt-1">{value}</div>
      {sublabel && <div className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</div>}
    </div>
  );
}
