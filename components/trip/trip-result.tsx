'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Battery, Clock, Zap, MapPin, Navigation, Share2, X, Trash2, Route, DollarSign,
} from 'lucide-react';
import type { TripCalcResult } from '@/lib/charging';
import type { ChargingStation } from '@/types';
import { OPERATOR_COLORS, OPERATOR_INITIALS, TESLA_MODEL_Y_JUNIPER } from '@/lib/constants';
import { estimateChargeTime } from '@/lib/charging';
import { formatCLP, formatDuration } from '@/lib/utils';

interface TripResultProps {
  result: TripCalcResult | null;
  origin: { name: string; lat: number; lng: number } | null;
  dest: { name: string; lat: number; lng: number } | null;
  startSoC: number;
  endSoC: number;
  safetyBuffer: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
  onStationClick: (s: ChargingStation) => void;
}

export function TripResult({
  result,
  origin,
  dest,
  startSoC,
  endSoC,
  safetyBuffer,
  open,
  onOpenChange,
  onClear,
  onStationClick,
}: TripResultProps) {
  if (!result || !origin || !dest) return null;

  const distance = result.distance;
  const durationMin = result.duration;
  const stops = result.suggestedStops;
  const dcChargeTo = 80;

  // Calcular timeline: cada parada con su tiempo de carga
  const totalChargeMin = stops.reduce((acc, s) => {
    const energyAdded = TESLA_MODEL_Y_JUNIPER.battery * (dcChargeTo - safetyBuffer) / 100;
    return acc + estimateChargeTime(s.pc, energyAdded);
  }, 0);

  const totalDuration = durationMin + totalChargeMin;

  const handleShareToCar = async () => {
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`;
    if (stops.length > 0) {
      const wp = stops.slice(0, 3).map((s) => `${s.lat},${s.lng}`).join('|');
      url += `&waypoints=${encodeURIComponent(wp)}`;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${origin.name} → ${dest.name}`,
          text: `${distance.toFixed(0)}km · ${stops.length} paradas DC`,
          url,
        });
      } catch (e) {}
    } else {
      window.open(url, '_blank');
    }
  };

  const handleOpenMaps = () => {
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`;
    if (stops.length > 0) {
      const wp = stops.slice(0, 3).map((s) => `${s.lat},${s.lng}`).join('|');
      url += `&waypoints=${encodeURIComponent(wp)}`;
    }
    window.open(url, '_blank');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="px-0">
        <SheetHeader className="px-5 pt-2 pb-3">
          <SheetTitle className="text-base flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            Ruta calculada
          </SheetTitle>
          <SheetDescription className="text-xs">
            {origin.name} → {dest.name}
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 pb-6 space-y-4">
          {/* Hero stats */}
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-blue-500/5 border border-primary/20 p-4 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              Tiempo total
            </div>
            <div className="text-3xl font-extrabold tracking-tight mt-1">
              {formatDuration(totalDuration)}
              {stops.length > 0 && (
                <span className="text-base font-bold text-muted-foreground ml-1">
                  ({stops.length} {stops.length === 1 ? 'parada' : 'paradas'})
                </span>
              )}
            </div>
            {totalChargeMin > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                Tiempo cargando: {formatDuration(totalChargeMin)}
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Distancia total"
              value={`${distance.toFixed(0)} km`}
            />
            <StatCard
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Conduciendo"
              value={formatDuration(durationMin)}
            />
            <StatCard
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="Costo eléctrico"
              value={formatCLP(result.cost)}
              valueClass="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              icon={<Battery className="h-3.5 w-3.5" />}
              label="Buffer entre paradas"
              value={`${safetyBuffer}%`}
            />
          </div>

          {/* Timeline */}
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3">
              📍 Timeline del viaje
            </div>

            <Timeline
              origin={origin}
              dest={dest}
              startSoC={startSoC}
              endSoC={endSoC}
              safetyBuffer={safetyBuffer}
              dcChargeTo={dcChargeTo}
              stops={stops}
              totalDistance={distance}
              totalDuration={durationMin}
              onStationClick={onStationClick}
            />
          </div>

          {/* Ahorro */}
          {result.savings > 0 && (
            <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-3 text-center text-sm font-bold shadow-lg shadow-emerald-500/20">
              💰 Ahorras {formatCLP(result.savings)} ({result.savingsPct}%) vs bencina 95
            </div>
          )}

          {/* Acciones */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleOpenMaps} className="gap-2">
              <Navigation className="h-4 w-4" />
              Maps
            </Button>
            <Button variant="outline" onClick={onClear} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Limpiar
            </Button>
          </div>
          <Button onClick={handleShareToCar} className="w-full gap-2">
            <Share2 className="h-4 w-4" />
            Compartir ruta al auto
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueClass = '',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3 border border-border/50">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">
        {icon}
        {label}
      </div>
      <div className={`font-bold text-base mt-1 ${valueClass}`}>{value}</div>
    </div>
  );
}

interface TimelineProps {
  origin: { name: string };
  dest: { name: string };
  startSoC: number;
  endSoC: number;
  safetyBuffer: number;
  dcChargeTo: number;
  stops: ChargingStation[];
  totalDistance: number;
  totalDuration: number;
  onStationClick: (s: ChargingStation) => void;
}

function Timeline({
  origin,
  dest,
  startSoC,
  endSoC,
  safetyBuffer,
  dcChargeTo,
  stops,
  totalDistance,
  totalDuration,
  onStationClick,
}: TimelineProps) {
  // Construir puntos del timeline
  const points = [
    { type: 'origin' as const, name: origin.name, soc: startSoC },
    ...stops.map((s) => ({ type: 'stop' as const, station: s })),
    { type: 'dest' as const, name: dest.name, soc: endSoC },
  ];

  return (
    <div className="space-y-1.5">
      {points.map((p, i) => {
        const next = points[i + 1];
        const isLast = i === points.length - 1;
        const segmentDistance = next ? totalDistance / (points.length - 1) : 0;
        const segmentDuration = next ? totalDuration / (points.length - 1) : 0;

        // SoC al salir y al llegar al siguiente punto
        const socOut =
          p.type === 'origin' ? startSoC : p.type === 'stop' ? dcChargeTo : 0;
        const socIn = next
          ? next.type === 'dest'
            ? endSoC
            : safetyBuffer
          : 0;

        return (
          <div key={i}>
            {/* Punto */}
            {p.type === 'origin' && (
              <PointMarker
                color="emerald"
                icon="📍"
                name={p.name}
                badge={`${p.soc}%`}
              />
            )}
            {p.type === 'dest' && (
              <PointMarker
                color="red"
                icon="🎯"
                name={p.name}
                badge={`~${p.soc}%`}
              />
            )}
            {p.type === 'stop' && (
              <StopCard
                station={p.station}
                index={stops.indexOf(p.station) + 1}
                socArrive={safetyBuffer}
                socLeave={dcChargeTo}
                onClick={() => onStationClick(p.station)}
              />
            )}

            {/* Segmento (línea con info) */}
            {!isLast && (
              <div className="ml-4 my-1 flex items-center gap-3 py-1">
                <div className="w-px h-8 bg-border" />
                <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Battery className="h-3 w-3" />
                  <span>{socOut}%</span>
                  <span className="opacity-50">→</span>
                  <span className="font-semibold">
                    {segmentDistance.toFixed(0)}km · {formatDuration(segmentDuration)}
                  </span>
                  <span className="opacity-50">→</span>
                  <Battery className="h-3 w-3" />
                  <span>{socIn}%</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PointMarker({
  color,
  icon,
  name,
  badge,
}: {
  color: 'emerald' | 'red';
  icon: string;
  name: string;
  badge: string;
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    red: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  };
  return (
    <div className={`rounded-xl border ${colorClasses[color]} p-3 flex items-center gap-3`}>
      <span className="text-xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm truncate">{name}</div>
      </div>
      <Badge variant="default" className="font-bold">
        {badge}
      </Badge>
    </div>
  );
}

function StopCard({
  station,
  index,
  socArrive,
  socLeave,
  onClick,
}: {
  station: ChargingStation;
  index: number;
  socArrive: number;
  socLeave: number;
  onClick: () => void;
}) {
  const color = OPERATOR_COLORS[station.op] || OPERATOR_COLORS.Otro;
  const initials = OPERATOR_INITIALS[station.op] || '?';

  // Tiempo de carga
  const energyAdded = TESLA_MODEL_Y_JUNIPER.battery * (socLeave - socArrive) / 100;
  const chargeMin = estimateChargeTime(station.pc, energyAdded);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-card border-2 border-emerald-500/30 hover:border-emerald-500 transition-all p-3 flex items-center gap-3 shadow-sm hover:shadow-md"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/30">
        {index}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-white text-[9px] font-bold"
            style={{ background: color }}
          >
            {initials}
          </span>
          <span className="font-bold text-sm truncate">{station.n}</span>
        </div>
        <div className="text-[10px] text-muted-foreground truncate mb-1">
          {station.c} · {station.pc}kW · {socArrive}% → {socLeave}%
        </div>
        <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
          <Clock className="h-3 w-3" />
          {formatDuration(chargeMin)} de carga
        </div>
      </div>
      <Zap className="h-5 w-5 text-emerald-500 shrink-0" />
    </button>
  );
}
