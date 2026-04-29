// ============== LÓGICA DE CARGA TESLA (validada en versión HTML) ==============
import type { ChargingStation, OSRMRoute } from '@/types';
import { TESLA_MODEL_Y_JUNIPER, COSTS } from './constants';
import { distToSegment, haversine } from './utils';

export interface TripCalcInput {
  origin: [number, number];
  dest: [number, number];
  startSoC: number;        // 0-100
  endSoC: number;          // 0-100 (target al destino)
  safetyBuffer: number;    // 0-100 SoC mínimo entre paradas
  dcChargeTo?: number;     // % al cargar en cada DC, default 80
  routeGeometry?: OSRMRoute['geometry'];
  candidates: ChargingStation[];
}

export interface TripCalcResult {
  distance: number;          // km
  duration: number;          // min
  consumption: number;       // kWh
  endSoCAchieved: number;    // SoC al destino sin cargar
  stopsNeeded: number;
  suggestedStops: ChargingStation[];
  cost: number;              // CLP
  gasolineCost: number;      // CLP
  savings: number;           // CLP
  savingsPct: number;
  routeGeometry?: OSRMRoute['geometry'];
}

/**
 * Calcular paradas DC óptimas usando modelo de tramos:
 * - Tramo 1: salida → buffer% (primera parada)
 * - Tramos intermedios: dcChargeTo% → buffer% (entre paradas)
 * - Tramo final: dcChargeTo% → endSoC% (a destino)
 */
export function calculateTrip(input: TripCalcInput): TripCalcResult {
  const TESLA = TESLA_MODEL_Y_JUNIPER;
  const dcChargeTo = (input.dcChargeTo ?? 80) / 100;
  const startSoC = input.startSoC / 100;
  const endSoC = input.endSoC / 100;
  const buffer = input.safetyBuffer / 100;

  // Distancia: si hay geometría real usar OSRM, si no haversine × 1.25
  let distance: number;
  let duration: number;
  if (input.routeGeometry) {
    // Calcular distancia real del path
    const coords = input.routeGeometry.coordinates;
    let d = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      d += haversine(
        [coords[i][1], coords[i][0]],
        [coords[i + 1][1], coords[i + 1][0]]
      );
    }
    distance = d;
    duration = (d / 90) * 60; // estimar 90 km/h promedio
  } else {
    distance = haversine(input.origin, input.dest) * 1.25;
    duration = (distance / 90) * 60;
  }

  const startEnergy = TESLA.battery * startSoC;
  const consumption = distance * TESLA.consumptionHwy;
  const endSoCAchieved = ((startEnergy - consumption) / TESLA.battery) * 100;

  // Modelo por tramos
  const kmPerPct = TESLA.battery / TESLA.consumptionHwy / 100;
  const tramo1Km = (startSoC - buffer) * 100 * kmPerPct;
  const tramoInterKm = (dcChargeTo - buffer) * 100 * kmPerPct;
  const tramoFinalKm = Math.max(0, (dcChargeTo - endSoC) * 100 * kmPerPct);
  const kmConSoloBateria = (startSoC - endSoC) * 100 * kmPerPct;

  let stopsActual = 0;
  const kmStops: number[] = [];

  if (distance <= kmConSoloBateria) {
    stopsActual = 0;
  } else if (distance <= tramo1Km + tramoFinalKm) {
    stopsActual = 1;
    kmStops.push(Math.min(tramo1Km, distance - tramoFinalKm));
  } else {
    const kmIntermediosTotal = distance - tramo1Km - tramoFinalKm;
    const intermedios = Math.ceil(kmIntermediosTotal / tramoInterKm);
    stopsActual = 1 + intermedios;
    kmStops.push(tramo1Km);
    for (let i = 1; i < intermedios; i++) {
      kmStops.push(tramo1Km + tramoInterKm * i);
    }
    kmStops.push(distance - tramoFinalKm);
  }

  // Filtrar candidatos en el corredor real
  let routePath: [number, number][];
  if (input.routeGeometry?.coordinates) {
    const full = input.routeGeometry.coordinates.map(
      (c) => [c[1], c[0]] as [number, number]
    );
    const step = Math.max(1, Math.floor(full.length / 100));
    routePath = [];
    for (let i = 0; i < full.length; i += step) routePath.push(full[i]);
    if (routePath[routePath.length - 1] !== full[full.length - 1]) {
      routePath.push(full[full.length - 1]);
    }
  } else {
    routePath = [input.origin, input.dest];
  }

  const candidates = input.candidates
    .filter((s) => s.fast && s.tcomp)
    .map((s) => {
      let minDetour = Infinity;
      let bestSegIdx = 0;
      for (let i = 0; i < routePath.length - 1; i++) {
        const d = distToSegment([s.lat, s.lng], routePath[i], routePath[i + 1]);
        if (d < minDetour) {
          minDetour = d;
          bestSegIdx = i;
        }
      }
      const progress = bestSegIdx / Math.max(1, routePath.length - 1);
      const distFromOrigin = progress * distance;
      return { ...s, _detour: minDetour, _distFromOrigin: distFromOrigin };
    })
    .filter(
      (s) =>
        s._detour < 30 &&
        s._distFromOrigin >= 50 &&
        s._distFromOrigin <= distance - 30
    )
    .sort((a, b) => a._distFromOrigin - b._distFromOrigin);

  // Buscar mejor cargador para cada km objetivo
  const finalStops: (ChargingStation & {
    _distFromOrigin: number;
    _detour: number;
  })[] = [];
  const used = new Set<string>();

  for (let i = 0; i < kmStops.length; i++) {
    const target = kmStops[i];
    const minKm = Math.max(20, target - 150);
    const maxKm = target + 150;

    const window = candidates
      .filter(
        (s) =>
          s._distFromOrigin >= minKm &&
          s._distFromOrigin <= maxKm &&
          !used.has(`${s.lat}_${s.lng}`)
      )
      .map((s) => ({
        ...s,
        _score:
          -Math.abs(s._distFromOrigin - target) * 1.5 +
          Math.min(s.pc, 200) * 0.4 -
          s._detour * 2,
      }))
      .sort((a, b) => b._score - a._score);

    if (window.length > 0) {
      finalStops.push(window[0]);
      used.add(`${window[0].lat}_${window[0].lng}`);
    }
  }

  // Cálculos económicos
  const energyDeficit = consumption - (startEnergy - TESLA.battery * endSoC);
  const dcEnergy = Math.max(0, energyDeficit);
  const cost = Math.round(dcEnergy * COSTS.electricityDC);
  const litersEq = (distance * 9) / 100;
  const gasolineCost = Math.round(litersEq * COSTS.gasoline95);
  const savings = gasolineCost - cost;
  const savingsPct = gasolineCost > 0 ? Math.round((savings / gasolineCost) * 100) : 0;

  return {
    distance,
    duration,
    consumption,
    endSoCAchieved,
    stopsNeeded: stopsActual,
    suggestedStops: finalStops,
    cost,
    gasolineCost,
    savings,
    savingsPct,
    routeGeometry: input.routeGeometry,
  };
}

/** Tiempo de carga estimado en minutos para una sesión */
export function estimateChargeTime(chargerKw: number, kwhAdded: number): number {
  const effectivePower = Math.min(chargerKw, TESLA_MODEL_Y_JUNIPER.dcMax) * 0.75;
  return (kwhAdded / effectivePower) * 60;
}
