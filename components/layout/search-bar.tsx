'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Building2, Mountain } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { autocompletePlaces, type AutocompletePrediction } from '@/lib/google-places';

interface SearchBarProps {
  onSelectPlace: (placeId: string) => void;
  onSelectCoords?: (lat: number, lng: number, name: string) => void;
}

export function SearchBar({ onSelectPlace }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      // Bias hacia el centro de Chile para resultados más relevantes
      const results = await autocompletePlaces(query, {
        latBias: -33.4489,
        lngBias: -70.6693,
        radius: 1500000, // 1500km radio (cubre todo Chile)
      });
      setPredictions(results);
      setLoading(false);
      setOpen(true);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (placeId: string) => {
    onSelectPlace(placeId);
    setQuery('');
    setPredictions([]);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setPredictions([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl glass p-2 pl-4 shadow-lg max-w-md">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          type="text"
          placeholder="Buscar ciudad, lugar, restaurante..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-7 w-7 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {open && (predictions.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 max-w-md rounded-2xl glass shadow-xl overflow-hidden border border-border/50 z-30">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Buscando...
            </div>
          )}

          {!loading && predictions.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              {predictions.map((p) => (
                <button
                  key={p.placePrediction.placeId}
                  onClick={() => handleSelect(p.placePrediction.placeId)}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-accent transition-colors text-left border-b border-border/30 last:border-0"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
                    {getIconForType(p.placePrediction.types?.[0])}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getIconForType(type?: string) {
  if (!type) return <MapPin className="h-4 w-4 text-muted-foreground" />;
  if (type.includes('locality') || type.includes('city')) {
    return <Building2 className="h-4 w-4 text-blue-500" />;
  }
  if (type.includes('park') || type.includes('natural')) {
    return <Mountain className="h-4 w-4 text-emerald-500" />;
  }
  return <MapPin className="h-4 w-4 text-muted-foreground" />;
}
