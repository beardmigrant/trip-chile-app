'use client';

import { useState, useRef, useEffect } from 'react';
import { Layers, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAP_STYLE_OPTIONS, type MapStyleId } from '@/components/map/map-view';

interface MapStyleSwitcherProps {
  current: MapStyleId;
  onChange: (id: MapStyleId) => void;
  /** Posicionamiento custom; default abajo a la izquierda */
  className?: string;
}

export function MapStyleSwitcher({
  current,
  onChange,
  className,
}: MapStyleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div
      ref={popoverRef}
      className={cn('absolute bottom-6 left-4 z-30', className)}
    >
      {/* Lista de opciones */}
      {open && (
        <div className="mb-2 rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-xl overflow-hidden min-w-[220px]">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Capa de mapa
            </div>
          </div>
          <div className="py-1">
            {MAP_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors',
                  'hover:bg-accent/60',
                  current === opt.id && 'bg-accent/40 font-medium'
                )}
              >
                <span>{opt.label}</span>
                {current === opt.id && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botón trigger */}
      <Button
        variant="default"
        size="icon"
        className="h-12 w-12 rounded-full shadow-xl bg-background hover:bg-accent text-foreground border border-border"
        onClick={() => setOpen((v) => !v)}
        aria-label="Cambiar capa de mapa"
        aria-expanded={open}
      >
        <Layers className="h-5 w-5" />
      </Button>
    </div>
  );
}
