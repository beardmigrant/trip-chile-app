// ============== CONSTANTES TESLA Y APP ==============

import type { VehicleConfig, OperatorName } from '@/types';

export const TESLA_MODEL_Y_JUNIPER: VehicleConfig = {
  model: 'Tesla Model Y RWD Juniper 2026',
  battery: 60,           // kWh útiles LFP
  consumptionHwy: 0.175, // kWh/km carretera 110km/h
  consumptionCity: 0.135,
  dcMax: 175,
  acMax: 11,
  rangeWltp: 466,
};

export const COSTS = {
  electricityDC: 350,    // CLP/kWh
  electricityHome: 140,  // CLP/kWh
  gasoline95: 1300,      // CLP/litro
} as const;

export const OPERATOR_COLORS: Record<OperatorName, string> = {
  'Copec Voltex': '#0066CC',
  'Enel X Way': '#E91E63',
  'Enex E-Pro': '#FF6600',
  'Tesla': '#CC0000',
  'SAESA': '#7C3AED',
  'Chilquinta': '#009639',
  'CGE': '#F59E0B',
  'Engie': '#10B981',
  'Mobilectric': '#0891B2',
  'EVlink': '#FBBF24',
  'Volvo': '#1F2937',
  'BMW': '#1C69D4',
  'Porsche': '#D5001C',
  'Otro': '#94a3b8',
};

export const OPERATOR_INITIALS: Record<OperatorName, string> = {
  'Copec Voltex': 'CV',
  'Enel X Way': 'EX',
  'Enex E-Pro': 'EP',
  'Tesla': 'TS',
  'SAESA': 'SA',
  'Chilquinta': 'CH',
  'CGE': 'CG',
  'Engie': 'EN',
  'Mobilectric': 'MO',
  'EVlink': 'EV',
  'Volvo': 'VO',
  'BMW': 'BM',
  'Porsche': 'PO',
  'Otro': '?',
};

export const POI_CATEGORIES = {
  historic: { label: 'Históricos', color: '#92400E', icon: '🏛️' },
  attraction: { label: 'Sitios de interés', color: '#0891B2', icon: '📍' },
  recreation: { label: 'Recreación', color: '#EC4899', icon: '🎭' },
  astro: { label: 'Astronomía', color: '#7C3AED', icon: '🌌' },
  nature: { label: 'Naturaleza', color: '#10B981', icon: '🌲' },
} as const;

export const DEFAULT_TRIP_SETTINGS = {
  startSoC: 90,
  endSoC: 50,
  safetyBuffer: 30,
  dcChargeTo: 80,
};

// Ciudades chilenas pre-cargadas
export const CITIES: Record<string, [number, number]> = {
  santiago: [-33.4489, -70.6693],
  providencia: [-33.4316, -70.6109],
  'las condes': [-33.4172, -70.5476],
  vitacura: [-33.3823, -70.5840],
  'lo barnechea': [-33.3500, -70.5167],
  rancagua: [-34.1700, -70.7400],
  curico: [-34.9828, -71.2391],
  talca: [-35.4264, -71.6554],
  linares: [-35.8460, -71.5933],
  chillan: [-36.6066, -72.1034],
  concepcion: [-36.8270, -73.0498],
  'los angeles': [-37.4683, -72.3536],
  temuco: [-38.7359, -72.5904],
  pucon: [-39.2706, -71.9758],
  villarrica: [-39.2856, -72.2306],
  'lican ray': [-39.5089, -72.0735],
  licanray: [-39.5089, -72.0735],
  valdivia: [-39.8142, -73.2459],
  panguipulli: [-39.6433, -72.3331],
  osorno: [-40.5722, -73.1340],
  frutillar: [-41.1247, -73.0383],
  'puerto varas': [-41.3197, -72.9856],
  'puerto montt': [-41.4717, -72.9367],
  ancud: [-41.8694, -73.8222],
  castro: [-42.4825, -73.7625],
  quellon: [-43.1180, -73.6190],
  coyhaique: [-45.5752, -72.0662],
  'punta arenas': [-53.1638, -70.9171],
  'la serena': [-29.9027, -71.2519],
  vicuna: [-30.0322, -70.7079],
  copiapo: [-27.3661, -70.3322],
  antofagasta: [-23.6500, -70.4000],
  iquique: [-20.2208, -70.1431],
  arica: [-18.4783, -70.3126],
};
