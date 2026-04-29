// ============== LÓGICA DE CARGA TESLA ==============
import type { ChargingStation, OSRMRoute } from '@/types';
import { TESLA_MODEL_Y_JUNIPER, COSTS } from './constants';
import { distToSegment, haversine } from './utils';

export interface TripCalcInput {
  origin: [number, number];
  dest: [number, number];
  startSoC: number;
  endSoC: number;
  safetyBuffer: number;
  dcChargeTo?: number;
  routeGeometry?: OSRMRoute['geometry'];
  candidates: ChargingStation[];
}

export interface TripCalcResult {
  distance: number;
  duration: number;
  consumption: number;
  endSoCAchieved: number;
  stopsNeeded: number;
  suggestedStops: ChargingStation[];
  cost: number;
  gasolineCost: number;
  savings: number;
  savingsPct: number;
  routeGeometry?: OSRMRoute['geometry'];
}

export function calculateTrip(input: TripCalcInput): TripCalcResult {
  const TESLA = TESLA_MODEL_Y_JUNIPER;
  const dcChargeTo = (input.dcChargeTo ?? 80) / 100;
  const startSoC = input.startSoC / 100;
  const endSoC = input.endSoC / 100;
  const buffer = input.safetyBuffer / 100;

  // Distancia real
  let distance: number;
  let duration: number;
  if (input.routeGeometry) {
    const coords = input.routeGeometry.coordinates;
    let d = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      d += haversine(
        [coords[i][1], coords[i][0]],
        [coords[i + 1][1], coords[i + 1][0]]
      );
    }
    distance = d;
    duration = (d / 90) * 60;
  } else {
    distance = haversine(input.origin, input.dest) * 1.25;
    duration = (distance / 90) * 60;
  }

  const startEnergy = TESLA.battery * startSoC;
  const consumption = distance * TESLA.consumptionHwy;
  const endSoCAchieved = ((startEnergy - consumption) / TESLA.battery) * 100;

  // Modelo de tramos
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

  // Path simplificado para detour
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

  // ============== CANDIDATOS CON FALLBACK INTELIGENTE ==============
  // Aceptamos cualquier cargador Tesla compatible (DC o AC).
  // El SCORING privilegia DC rápida; AC solo se elige si no hay DC en la zona.
  const candidates = input.candidates
    .filter((s) => s.tcomp) // solo Tesla compatible (DC o AC)
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

  // ============== SELECCIÓN CON SCORING JERÁRQUICO ==============
  const finalStops: (ChargingStation & {
    _distFromOrigin: number;
    _detour: number;
  })[] = [];
  const used = new Set<string>();

  for (let i = 0; i < kmStops.length; i++) {
    const target = kmStops[i];
    const isLast = i === kmStops.length - 1;

    const window = isLast
      ? Math.max(80, tramoInterKm * 0.5)
      : Math.max(80, tramoInterKm * 0.4);
    const minKm = Math.max(20, target - window);
    const maxKm = isLast ? target + 30 : target + window;

    const inWindow = candidates
      .filter(
        (s) =>
          s._distFromOrigin >= minKm &&
          s._distFromOrigin <= maxKm &&
          !used.has(`${s.lat}_${s.lng}`)
      )
      .map((s) => {
        // SCORING JERÁRQUICO: prefiere DC sobre AC, ultra-rápido sobre rápido
        let typeBonus = 0;
        if (s.tc === 'DC') {
          // DC: bonus base alto + bonus por potencia
          typeBonus = 100;
          if (s.pc >= 150) typeBonus += 50; // ultra-rápida 150kW+
          else if (s.pc >= 100) typeBonus += 30; // muy rápida 100kW+
          else if (s.pc >= 50) typeBonus += 15; // rápida 50kW+
          // DC <50kW solo +0 extra (raro pero existe)
        } else {
          // AC: penalización fuerte (carga lenta, 6-10h vs 30-60min DC)
          // Pero NO los descartamos completamente — son fallback en zonas remotas
          typeBonus = -50;
          // AC trifásica 22kW es el mejor caso de AC, levemente mejor
          if (s.pc >= 22) typeBonus += 10;
        }

        return {
          ...s,
          _score:
            // Cercanía al target ideal (peso fuerte)
            -Math.abs(s._distFromOrigin - target) * 2.5 +
            // Tipo de cargador (DC mucho mejor que AC)
            typeBonus +
            // Penalización por desvío de la ruta
            -s._detour * 3,
        };
      })
      .sort((a, b) => b._score - a._score);

    if (inWindow.length > 0) {
      const chosen = inWindow[0];
      finalStops.push(chosen);
      used.add(`${chosen.lat}_${chosen.lng}`);
    }
  }

  // Cálculos económicos
  const dcEnergy = stopsActual > 0 ? Math.max(0, consumption - (startEnergy - TESLA.battery * endSoC)) : 0;
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

export function estimateChargeTime(chargerKw: number, kwhAdded: number): number {
  const effectivePower = Math.min(chargerKw, TESLA_MODEL_Y_JUNIPER.dcMax) * 0.75;
  return (kwhAdded / effectivePower) * 60;
}
