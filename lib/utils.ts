import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Distancia haversine en km entre dos puntos [lat,lng] */
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]);
  const dLng = toR(b[1] - a[1]);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(A));
}

/** Distancia mínima de un punto a un segmento */
export function distToSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const A = haversine(a, p);
  const B = haversine(b, p);
  const C = haversine(a, b);
  if (C === 0) return A;
  const t = Math.max(0, Math.min(1, (A * A - B * B + C * C) / (2 * C * C)));
  const proj: [number, number] = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  return haversine(p, proj);
}

/** Formatear duración de minutos a "Xh Ymin" */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

/** Formatear CLP con separador de miles */
export function formatCLP(amount: number): string {
  return `$${amount.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
}

/** Capitalizar palabras */
export function capitalize(s: string): string {
  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Parsear "lat,lng" a tupla */
export function parseLatLng(s: string): [number, number] | null {
  if (!s) return null;
  const m = s.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

/** Generar ID único simple */
export function uid(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}
