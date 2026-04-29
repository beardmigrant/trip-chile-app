'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Locate } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincronizar query con value
  useEffect(() => {
    if (value) setQuery(value.name);
    else setQuery('');
  }, [value]);

  // Cerrar dropdown al click fuera
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

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalización no disponible en este navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          name: 'Mi ubicación actual',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setQuery('Mi ubicación actual');
      },
      (err) => {
        alert('No se pudo obtener tu ubicación. Verifica permisos.');
        console.error(err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {showLocation && !query && (
          <button
            onClick={handleUseLocation}
            className="text-primary hover:opacity-80 shrink-0 p-1"
            title="Usar mi ubicación"
          >
            <Locate className="h-4 w-4" />
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
