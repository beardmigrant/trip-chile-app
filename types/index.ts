// ============== TIPOS GLOBALES ==============

export interface ChargingStation {
  n: string;
  r: string;
  c: string;
  d: string;
  lat: number;
  lng: number;
  op: OperatorName;
  pe: number;
  pc: number;
  nc: number;
  co: ConnectorType[];
  tc: 'DC' | 'AC';
  fast: boolean;
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
  duration?: number;
  cost?: number;
  imageUrl?: string;
  wikipediaUrl?: string;
  websiteUrl?: string;
  bestTime?: 'morning' | 'afternoon' | 'evening' | 'any';
  tags?: string[];
}

export type POICategory =
  | 'lodging'
  | 'food'
  | 'historic'
  | 'attraction'
  | 'nature'
  | 'recreation'
  | 'astro'
  | 'services';

export interface RoutePoint {
  lat: number;
  lng: number;
  name?: string;
}

export interface OSRMRoute {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

export interface VehicleConfig {
  model: string;
  battery: number;
  consumptionHwy: number;
  consumptionCity: number;
  dcMax: number;
  acMax: number;
  rangeWltp: number;
}

export interface TripSettings {
  startSoC: number;
  endSoC: number;
  safetyBuffer: number;
  dcChargeTo: number;
}

export type Theme = 'light' | 'dark' | 'system';

export interface TripLocation {
  name: string;
  lat: number;
  lng: number;
}
