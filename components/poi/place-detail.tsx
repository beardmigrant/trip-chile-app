'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Star, MapPin, Navigation, Heart, ExternalLink, Clock, Phone, Globe, ImageIcon,
} from 'lucide-react';
import type { GooglePlace } from '@/lib/google-places';
import { getPlaceDetails, getPhotoUrl } from '@/lib/google-places';

interface PlaceDetailProps {
  placeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToRoute?: (place: GooglePlace) => void;
}

export function PlaceDetail({ placeId, open, onOpenChange, onAddToRoute }: PlaceDetailProps) {
  const [place, setPlace] = useState<GooglePlace | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!placeId || !open) {
      setPlace(null);
      return;
    }

    setLoading(true);
    getPlaceDetails(placeId).then((data) => {
      setPlace(data);
      setLoading(false);
    });
  }, [placeId, open]);

  if (!placeId) return null;

  const photoUrl = place?.photos?.[0]
    ? getPhotoUrl(place.photos[0].name, 800)
    : null;

  const handleOpenInGoogleMaps = () => {
    if (!place) return;
    const url = `https://www.google.com/maps/place/?q=place_id:${place.id}`;
    window.open(url, '_blank');
  };

  const handleShareToCar = async () => {
    if (!place) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${place.location.latitude},${place.location.longitude}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: place.displayName.text, url });
      } catch (e) {
        // cancelled
      }
    } else {
      navigator.clipboard?.writeText(url);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="px-0">
        {/* Title y description SIEMPRE presentes para accesibilidad */}
        {loading && (
          <>
            <SheetHeader className="px-5 pt-4 pb-3 sr-only">
              <SheetTitle>Cargando lugar</SheetTitle>
              <SheetDescription>Obteniendo información del lugar seleccionado</SheetDescription>
            </SheetHeader>
            <div className="px-5 py-12 text-center text-muted-foreground">
              <div className="animate-pulse">Cargando información...</div>
            </div>
          </>
        )}

        {place && !loading && (
          <>
            {/* Foto principal */}
            {photoUrl ? (
              <div className="relative w-full h-48 bg-muted">
                <Image
                  src={photoUrl}
                  alt={place.displayName.text}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-primary/20 to-blue-500/20 grid place-items-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}

            <SheetHeader className="px-5 pt-4 pb-3">
              <SheetTitle className="text-base leading-tight">
                {place.displayName.text}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Detalles del lugar: {place.displayName.text}
              </SheetDescription>

              {/* Rating + tipo + estado */}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {place.rating && (
                  <div className="flex items-center gap-1 text-xs font-semibold">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {place.rating.toFixed(1)}
                    {place.userRatingCount && (
                      <span className="text-muted-foreground font-normal">
                        ({place.userRatingCount})
                      </span>
                    )}
                  </div>
                )}
                {place.primaryTypeDisplayName?.text && (
                  <Badge variant="default" className="text-[10px]">
                    {place.primaryTypeDisplayName.text}
                  </Badge>
                )}
                {place.regularOpeningHours?.openNow !== undefined && (
                  <Badge
                    variant={place.regularOpeningHours.openNow ? 'success' : 'warning'}
                    className="text-[10px]"
                  >
                    {place.regularOpeningHours.openNow ? '🟢 Abierto' : '🔴 Cerrado'}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="px-5 pb-6 space-y-4">
              {/* Dirección */}
              {place.formattedAddress && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-muted-foreground">{place.formattedAddress}</div>
                </div>
              )}

              {/* Descripción editorial */}
              {place.editorialSummary?.text && (
                <div className="text-sm leading-relaxed">
                  {place.editorialSummary.text}
                </div>
              )}

              {/* Horarios */}
              {place.regularOpeningHours?.weekdayDescriptions && (
                <div className="rounded-xl bg-muted/50 p-3 border border-border/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-2">
                    <Clock className="h-3 w-3" />
                    Horarios
                  </div>
                  <div className="space-y-0.5">
                    {place.regularOpeningHours.weekdayDescriptions.slice(0, 7).map((d, i) => (
                      <div key={i} className="text-xs text-muted-foreground">
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contacto */}
              <div className="grid grid-cols-2 gap-2">
                {place.internationalPhoneNumber && (
                  <a
                    href={`tel:${place.internationalPhoneNumber}`}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50 hover:bg-muted text-sm font-medium"
                  >
                    <Phone className="h-4 w-4" />
                    Llamar
                  </a>
                )}
                {place.websiteUri && (
                  <a
                    href={place.websiteUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50 hover:bg-muted text-sm font-medium"
                  >
                    <Globe className="h-4 w-4" />
                    Sitio web
                  </a>
                )}
              </div>

              {/* Acciones */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={handleOpenInGoogleMaps} className="gap-2">
                  <Navigation className="h-4 w-4" />
                  Maps
                </Button>
                <Button onClick={handleShareToCar} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Compartir
                </Button>
              </div>

              {onAddToRoute && (
                <Button
                  variant="success"
                  onClick={() => onAddToRoute(place)}
                  className="w-full gap-2"
                >
                  <Heart className="h-4 w-4" />
                  Agregar a mi ruta
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
