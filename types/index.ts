// ============== TIPOS GLOBALES ==============

export interface ChargingStation {
  /** Nombre */
  n: string;
  /** Región */
  r: string;
  /** Comuna */
  c: string;
  /** Dirección */
  d: string;
  /** Latitud */
  lat: number;
  /** Longitud */
  lng: number;
  /** Operador */
  op: OperatorName;
  /** Potencia estación (kW) */
  pe: number;
  /** Potencia cargador (kW) */
  pc: number;
  /** Número conectores */
  nc: number;
  /** Conectores disponibles */
  co: ConnectorType[];
  /** Tipo carga */
  tc: 'DC' | 'AC';
  /** Es DC rápida (>=50kW) */
  fast: boolean;
  /** Compatible con Tesla (CCS2/Tipo2) */
  tcomp: boolean;
}

export type OperatorName =
  | 'Copec Voltex'
  | 'Enel X Way'
  | 'Enex E-Pro'
  | 'Tesla'
  | 'SAESA'
  | 'Chilquinta'
  | 'CGE'
  | 'Engie'
  | 'Mobilectric'
  | 'EVlink'
  | 'Volvo'
  | 'BMW'
  | 'Porsche'
  | 'Otro';

export type ConnectorType = 'CCS2' | 'CCS1' | 'Tipo 2' | 'Tipo 1' | 'CHAdeMO' | 'GB/T';

export interface POI {
  id: string;
  name: string;
  category: POICategory;
  description?: string;
  lat: number;
  lng: number;
  city?: string;
  region?: string;
  address?: string;
  rating?: number;
  priority?: 1 | 2 | 3 | 4 | 5;
  duration?: number; // minutos sugeridos
  cost?: number; // CLP
  imageUrl?: string;
  wikipediaUrl?: string;
  websiteUrl?: string;
  bestTime?: 'morning' | 'afternoon' | 'evening' | 'any';
  tags?: string[];
}

export type POICategory =
  | 'historic'
  | 'attraction'
  | 'recreation'
  | 'astro'
  | 'nature';

export interface RoutePoint {
  lat: number;
  lng: number;
  name?: string;
}

export interface OSRMRoute {
  distance: number; // metros
  duration: number; // segundos
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat]
  };
}

export interface TripDay {
  id: string;
  date: string; // ISO YYYY-MM-DD
  type: 'transit' | 'base';
  /** Para tránsito */
  from?: RoutePoint;
  to?: RoutePoint;
  /** Para base con excursiones */
  base?: RoutePoint;
  excursions?: RoutePoint[];
  /** POIs activados/desactivados */
  pois?: { id: string; status: 'visit' | 'maybe' | 'skip' }[];
  /** Notas del usuario */
  notes?: string;
  /** Resultado calculado */
  computed?: {
    distance: number;
    duration: number;
    suggestedStops: ChargingStation[];
    cost: number;
  };
}

export interface Itinerary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  vehicle: VehicleConfig;
  days: TripDay[];
  createdAt: number;
  updatedAt: number;
}

export interface VehicleConfig {
  model: string;
  battery: number; // kWh
  consumptionHwy: number; // kWh/km
  consumptionCity: number; // kWh/km
  dcMax: number; // kW
  acMax: number; // kW
  rangeWltp: number; // km
}

export interface TripSettings {
  startSoC: number; // %
  endSoC: number; // %
  safetyBuffer: number; // % SoC mínimo entre paradas
  dcChargeTo: number; // % carga típica DC
}

export type Theme = 'light' | 'dark' | 'system';
