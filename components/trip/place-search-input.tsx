'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Locate, Loader2 } from 'lucide-react';
import { autocompletePlaces, getPlaceDetails, type AutocompletePrediction } from '@/lib/google-places';

interface PlaceSearchInputProps {
  label: string;
  placeholder?: string;
  value: { name: string; lat: number; lng: number } | null;
  onChange: (place: { name: string; lat: number; lng: number } | null) => void;
  showLocation?: boolean;
}

export function PlaceSearchInput({
  label,
  placeholder = 'Buscar ciudad o lugar...',
  value,
  onChange,
  showLocation = false,
}: PlaceSearchInputProps) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setQuery(value.name);
    else setQuery('');
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2 || query === value?.name) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await autocompletePlaces(query, {
        latBias: -33.4489,
        lngBias: -70.6693,
        radius: 50000,
      });
      setPredictions(results);
      setLoading(false);
      setOpen(true);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, value?.name]);

  const handleSelect = async (placeId: string, name: string) => {
    setResolving(true);
    setOpen(false);
    setQuery(name);

    const details = await getPlaceDetails(placeId);
    if (details) {
      onChange({
        name: details.displayName.text,
        lat: details.location.latitude,
        lng: details.location.longitude,
      });
    }
    setResolving(false);
    setPredictions([]);
  };

  const handleClear = () => {
    setQuery('');
    onChange(null);
    setPredictions([]);
    setOpen(false);
  };

  // ============== GEOLOCATION MEJORADA ==============
  const handleUseLocation = async () => {
    // Verificar soporte
    if (!navigator.geolocation) {
      alert('❌ Tu navegador no soporta geolocalización.');
      return;
    }

    // Verificar contexto seguro (HTTPS o localhost)
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      alert(
        '⚠️ La geolocalización solo funciona en HTTPS.\n\n' +
        'Si abriste la app desde un archivo local (file://), necesitas hostearla en GitHub Pages, Vercel o similar.\n\n' +
        'Si ya está en HTTPS, recarga la página.'
      );
      return;
    }

    setLocating(true);

    // Verificar permisos primero (si el navegador lo soporta)
    if ('permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });

        if (permission.state === 'denied') {
          setLocating(false);
          alert(
            '❌ Permiso de ubicación bloqueado.\n\n' +
            '📱 Para activarlo:\n' +
            '1. Toca el ícono de candado 🔒 en la barra de direcciones\n' +
            '2. Toca "Permisos del sitio" o "Configuración del sitio"\n' +
            '3. Activa "Ubicación"\n' +
            '4. Recarga la página y toca el ícono otra vez\n\n' +
            'En Chrome Android también puedes ir a Configuración > Privacidad > Ubicación.'
          );
          return;
        }
      } catch (e) {
        // Algunos navegadores antiguos no soportan permissions API, ignorar
      }
    }

    // Solicitar ubicación con configuración robusta
    const tryGeolocation = (highAccuracy: boolean): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: highAccuracy,
            timeout: highAccuracy ? 15000 : 30000,
            maximumAge: 60000, // acepta una posición cacheada de hasta 1 min
          }
        );
      });
    };

    try {
      // Primer intento: alta precisión (GPS)
      let pos: GeolocationPosition;
      try {
        pos = await tryGeolocation(true);
      } catch (highAccErr: unknown) {
        const err = highAccErr as GeolocationPositionError;
        // Si falla por timeout o no disponible, reintentar con baja precisión (red WiFi/celular)
        if (err.code === 2 || err.code === 3) {
          console.log('Reintentando geolocalización con baja precisión...');
          pos = await tryGeolocation(false);
        } else {
          throw err;
        }
      }

      onChange({
        name: 'Mi ubicación actual',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setQuery('Mi ubicación actual');
    } catch (err: unknown) {
      const e = err as GeolocationPositionError;
      console.error('Geolocation error:', e);

      let message = '❌ No se pudo obtener tu ubicación.\n\n';

      if (e.code === 1) {
        // PERMISSION_DENIED
        message +=
          '🚫 Permiso denegado.\n\n' +
          '📱 Para activarlo en Chrome Android:\n' +
          '1. Toca el candado 🔒 en la barra de direcciones\n' +
          '2. "Permisos" → activa "Ubicación"\n' +
          '3. Recarga la página\n\n' +
          'Verifica también que la ubicación esté activada en tu celular (Configuración → Ubicación).';
      } else if (e.code === 2) {
        // POSITION_UNAVAILABLE
        message +=
          '📵 GPS no disponible.\n\n' +
          'Verifica:\n' +
          '• La ubicación de tu celular está activada\n' +
          '• Tienes señal WiFi o datos\n' +
          '• Sal a un lugar abierto si estás dentro de un edificio';
      } else if (e.code === 3) {
        // TIMEOUT
        message +=
          '⏱️ Tiempo agotado.\n\n' +
          'Intenta de nuevo o ingresa la ciudad manualmente.';
      } else {
        message += 'Error desconocido. Intenta de nuevo o ingresa la ciudad manualmente.';
      }

      alert(message);
    } finally {
      setLocating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
        {label}
      </label>

      <div className="flex items-center gap-1.5 rounded-xl bg-muted/50 border border-border px-3 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground min-w-0"
        />
        {query && (
          <button
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground shrink-0 p-1"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {showLocation && !query && (
          <button
            onClick={handleUseLocation}
            disabled={locating}
            className="text-primary hover:opacity-80 shrink-0 p-1 disabled:opacity-50"
            title="Usar mi ubicación"
            type="button"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Locate className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (predictions.length > 0 || loading || resolving) && (
        <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl bg-card border border-border shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
          {(loading || resolving) && (
            <div className="px-4 py-4 text-center text-sm text-muted-foreground">
              {resolving ? 'Cargando...' : 'Buscando...'}
            </div>
          )}

          {!loading && !resolving && predictions.length > 0 && (
            <>
              {predictions.map((p) => (
                <button
                  key={p.placePrediction.placeId}
                  onClick={() =>
                    handleSelect(
                      p.placePrediction.placeId,
                      p.placePrediction.structuredFormat?.mainText?.text ||
                        p.placePrediction.text.text
                    )
                  }
                  className="w-full px-4 py-2.5 flex items-start gap-2.5 hover:bg-accent transition-colors text-left border-b border-border/30 last:border-0"
                  type="button"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {p.placePrediction.structuredFormat?.mainText?.text ||
                        p.placePrediction.text.text}
                    </div>
                    {p.placePrediction.structuredFormat?.secondaryText?.text && (
                      <div className="text-xs text-muted-foreground truncate">
                        {p.placePrediction.structuredFormat.secondaryText.text}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
