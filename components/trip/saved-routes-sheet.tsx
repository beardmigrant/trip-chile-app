'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getSavedRoutes,
  deleteRoute,
  renameRoute,
  type SavedRoute,
} from '@/lib/saved-routes';
import { Star, Trash2, Pencil, Check, X, MapPin, Battery, Shield } from 'lucide-react';

interface SavedRoutesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadRoute: (route: SavedRoute) => void;
}

export function SavedRoutesSheet({
  open,
  onOpenChange,
  onLoadRoute,
}: SavedRoutesSheetProps) {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Recargar rutas cuando se abre el sheet
  useEffect(() => {
    if (open) {
      setRoutes(getSavedRoutes());
      setEditingId(null);
      setError(null);
    }
  }, [open]);

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    deleteRoute(id);
    setRoutes(getSavedRoutes());
  };

  const startEditing = (route: SavedRoute) => {
    setEditingId(route.id);
    setEditingName(route.name);
    setError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
    setError(null);
  };

  const confirmRename = (id: string) => {
    try {
      renameRoute(id, editingName);
      setRoutes(getSavedRoutes());
      setEditingId(null);
      setEditingName('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al renombrar');
    }
  };

  const handleLoad = (route: SavedRoute) => {
    onLoadRoute(route);
    onOpenChange(false);
  };

  const formatDate = (ts: number): string => {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) {
      return `Hoy ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return d.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'short',
    });
  };

  const safetyLabel = (buffer: number): string => {
    if (buffer <= 10) return 'Mínimo';
    if (buffer <= 20) return 'Normal';
    if (buffer <= 30) return 'Seguro';
    return 'Extremo';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            Mis rutas guardadas
          </SheetTitle>
          <SheetDescription>
            {routes.length === 0
              ? 'Aún no tienes rutas guardadas'
              : `${routes.length} ${routes.length === 1 ? 'ruta' : 'rutas'} disponibles`}
          </SheetDescription>
        </SheetHeader>

        {error && (
          <div className="mb-3 rounded-md bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Star className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Calcula una ruta y guárdala con la estrella ⭐ para acceder rápido en tu próximo viaje.
            </p>
          </div>
        ) : (
          <div className="space-y-2 pb-6">
            {routes.map((route) => (
              <div
                key={route.id}
                className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50"
              >
                {editingId === route.id ? (
                  /* Modo edición de nombre */
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmRename(route.id);
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      autoFocus
                      className="flex-1"
                      placeholder="Nombre de la ruta"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => confirmRename(route.id)}
                      className="h-9 w-9 shrink-0"
                      aria-label="Confirmar nombre"
                    >
                      <Check className="h-4 w-4 text-emerald-600" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={cancelEditing}
                      className="h-9 w-9 shrink-0"
                      aria-label="Cancelar edición"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  /* Modo display */
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <button
                        onClick={() => handleLoad(route)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="font-semibold text-sm truncate">
                          {route.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {route.origin.name.split(',')[0]} → {route.destination.name.split(',')[0]}
                          </span>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditing(route)}
                          className="h-8 w-8"
                          aria-label="Renombrar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(route.id, route.name)}
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Battery className="h-3 w-3" />
                        {route.startSoC}% → {route.endSoC}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {safetyLabel(route.safetyBuffer)}
                      </span>
                      {route.activeCategories.length > 0 && (
                        <span>
                          {route.activeCategories.length} {route.activeCategories.length === 1 ? 'categoría' : 'categorías'}
                        </span>
                      )}
                      <span className="ml-auto">{formatDate(route.savedAt)}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
