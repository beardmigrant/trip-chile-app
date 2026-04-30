'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Star, MapPin, Plus, X, Eye, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { POI_CATEGORIES } from '@/lib/constants';
import { getPhotoUrl } from '@/lib/google-places';
import type { POISuggestion } from '@/lib/poi-search';

interface POISuggestionCardProps {
  poi: POISuggestion;
  isAdded: boolean;
  isSkipped: boolean;
  onAdd: () => void;
  onSkip: () => void;
  onViewDetails: () => void;
}

export function POISuggestionCard({
  poi,
  isAdded,
  isSkipped,
  onAdd,
  onSkip,
  onViewDetails,
}: POISuggestionCardProps) {
  const cat = POI_CATEGORIES[poi.category as keyof typeof POI_CATEGORIES];
  const photoUrl = poi.photos?.[0] ? getPhotoUrl(poi.photos[0].name, 400) : null;

  if (isSkipped) {
    // POI saltado → versión muy compacta
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30 opacity-60">
        <X className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground flex-1 truncate">
          {poi.displayName.text}
        </span>
        <button
          onClick={onAdd}
          className="text-[10px] text-primary hover:underline font-semibold"
        >
          Recuperar
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl overflow-hidden border-2 transition-all ${
        isAdded
          ? 'border-emerald-500 bg-emerald-500/5'
          : 'border-border bg-card hover:border-primary/50'
      }`}
    >
      <div className="flex gap-3 p-3">
        {/* Foto */}
        {photoUrl ? (
          <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
            <Image
              src={photoUrl}
              alt={poi.displayName.text}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div
            className="w-20 h-20 shrink-0 rounded-lg grid place-items-center text-2xl"
            style={{ background: cat?.color + '20', color: cat?.color }}
          >
            {cat?.icon || '📍'}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm leading-tight line-clamp-1">
            {poi.displayName.text}
          </div>

          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
            {poi.rating && (
              <span className="flex items-center gap-0.5 font-semibold text-foreground">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {poi.rating.toFixed(1)}
                {poi.userRatingCount && ` (${poi.userRatingCount})`}
              </span>
            )}
            <span
              className="inline-block w-1 h-1 rounded-full bg-muted-foreground/50"
              aria-hidden
            />
            <span>km {poi.distFromOrigin.toFixed(0)}</span>
            <span
              className="inline-block w-1 h-1 rounded-full bg-muted-foreground/50"
              aria-hidden
            />
            <span>desvío {poi.detour.toFixed(1)}km</span>
          </div>

          {cat && (
            <Badge
              variant="default"
              className="mt-1.5 text-[9px]"
              style={{
                background: cat.color + '20',
                color: cat.color,
                borderColor: cat.color + '40',
              }}
            >
              {cat.icon} {cat.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-3 gap-1 p-1.5 bg-muted/30 border-t border-border/50">
        <Button
          size="sm"
          variant="ghost"
          onClick={onViewDetails}
          className="h-8 text-[10px] gap-1"
        >
          <Eye className="h-3 w-3" />
          Ver
        </Button>

        {isAdded ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onSkip}
            className="h-8 text-[10px] gap-1 text-emerald-700 dark:text-emerald-400 col-span-2"
          >
            <Check className="h-3 w-3" />
            Agregada
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={onSkip}
              className="h-8 text-[10px] gap-1 text-muted-foreground"
            >
              <X className="h-3 w-3" />
              Saltar
            </Button>
            <Button
              size="sm"
              onClick={onAdd}
              className="h-8 text-[10px] gap-1"
            >
              <Plus className="h-3 w-3" />
              Visitar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
