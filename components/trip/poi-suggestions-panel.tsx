'use client';

import { useState, useEffect } from 'react';
import { Loader2, MapPin, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { POISuggestionCard } from './poi-suggestion-card';
import type { POISuggestion } from '@/lib/poi-search';
import { searchPOIsAlongRoute } from '@/lib/poi-search';
import type { OSRMRoute } from '@/types';
import { POI_CATEGORIES } from '@/lib/constants';

interface POISuggestionsPanelProps {
  routeGeometry?: OSRMRoute['geometry'];
  totalDistance: number;
  activeCategories: Set<string>;
  addedPOIs: Set<string>;
  skippedPOIs: Set<string>;
  onAddPOI: (poi: POISuggestion) => void;
  onSkipPOI: (poiId: string) => void;
  onViewPOI: (placeId: string) => void;
}

export function POISuggestionsPanel({
  routeGeometry,
  totalDistance,
  activeCategories,
  addedPOIs,
  skippedPOIs,
  onAddPOI,
  onSkipPOI,
  onViewPOI,
}: POISuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<POISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [searchedKey, setSearchedKey] = useState<string>('');

  // Auto-buscar cuando cambia la ruta o las categorías activas
  useEffect(() => {
    if (!routeGeometry || activeCategories.size === 0) {
      setSuggestions([]);
      return;
    }

    // Key único de cache: ruta + categorías
    const key = `${routeGeometry.coordinates[0]?.join(',')}_${routeGeometry.coordinates.slice(-1)[0]?.join(',')}_${Array.from(activeCategories).sort().join(',')}`;

    if (key === searchedKey) return; // ya buscamos para esta combinación

    let cancelled = false;
    setLoading(true);
    setSearchedKey(key);

    searchPOIsAlongRoute(routeGeometry, totalDistance, activeCategories).then(
      (results) => {
        if (cancelled) return;
        setSuggestions(results);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [routeGeometry, totalDistance, activeCategories, searchedKey]);

  // Si no hay categorías activas, mostrar mensaje
  if (activeCategories.size === 0) {
    return (
      <div className="rounded-xl bg-muted/30 border border-dashed border-border p-4 text-center">
        <Sparkles className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          Activa categorías arriba (🏛️ Históricos, 🌲 Naturaleza, etc.) para que el sistema
          sugiera lugares de interés en tu ruta.
        </div>
      </div>
    );
  }

  // Filtrar suggestions: las saltadas van al final
  const visibleSuggestions = suggestions.filter((s) => !skippedPOIs.has(s.id));
  const skippedSuggestions = suggestions.filter((s) => skippedPOIs.has(s.id));

  const addedCount = suggestions.filter((s) => addedPOIs.has(s.id)).length;

  return (
    <div className="space-y-2">
      {/* Header colapsable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold hover:text-foreground transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">
          ✨ Sugerencias en ruta
          {suggestions.length > 0 && ` (${suggestions.length})`}
          {addedCount > 0 && (
            <Badge variant="success" className="ml-2">
              {addedCount} agregadas
            </Badge>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {expanded && (
        <>
          {loading && (
            <div className="rounded-xl bg-muted/30 border border-dashed border-border p-6 text-center">
              <Loader2 className="h-5 w-5 mx-auto animate-spin text-primary mb-2" />
              <div className="text-xs text-muted-foreground">
                Buscando lugares de interés en tu ruta...
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Categorías:{' '}
                {Array.from(activeCategories)
                  .map(
                    (c) =>
                      POI_CATEGORIES[c as keyof typeof POI_CATEGORIES]?.label || c
                  )
                  .join(', ')}
              </div>
            </div>
          )}

          {!loading && suggestions.length === 0 && (
            <div className="rounded-xl bg-muted/30 border border-dashed border-border p-4 text-center">
              <MapPin className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
              <div className="text-xs text-muted-foreground">
                No se encontraron lugares en tu ruta para las categorías seleccionadas.
              </div>
            </div>
          )}

          {!loading && visibleSuggestions.length > 0 && (
            <div className="space-y-2">
              {visibleSuggestions.map((poi) => (
                <POISuggestionCard
                  key={poi.id}
                  poi={poi}
                  isAdded={addedPOIs.has(poi.id)}
                  isSkipped={false}
                  onAdd={() => onAddPOI(poi)}
                  onSkip={() => onSkipPOI(poi.id)}
                  onViewDetails={() => onViewPOI(poi.id)}
                />
              ))}
            </div>
          )}

          {/* POIs saltados (versión compacta) */}
          {!loading && skippedSuggestions.length > 0 && (
            <details className="space-y-1.5 mt-3">
              <summary className="text-[10px] text-muted-foreground cursor-pointer uppercase tracking-wider font-semibold">
                {skippedSuggestions.length} saltadas
              </summary>
              <div className="space-y-1 mt-2">
                {skippedSuggestions.map((poi) => (
                  <POISuggestionCard
                    key={poi.id}
                    poi={poi}
                    isAdded={false}
                    isSkipped={true}
                    onAdd={() => onAddPOI(poi)}
                    onSkip={() => {}}
                    onViewDetails={() => onViewPOI(poi.id)}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
