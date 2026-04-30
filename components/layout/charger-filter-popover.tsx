'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Filter, X, Check, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { OPERATOR_COLORS, OPERATOR_INITIALS } from '@/lib/constants';
import type { OperatorName } from '@/types';

export interface ChargerFilters {
  operators: Set<OperatorName>;
  types: Set<'DC' | 'AC'>;
  speeds: Set<'ultra' | 'fast' | 'slow'>;
  teslaOnly: boolean;
}

interface Props {
  active: boolean;
  count: number;
  totalCount: number;
  filters: ChargerFilters;
  onActiveChange: (active: boolean) => void;
  onFiltersChange: (filters: ChargerFilters) => void;
}

const ALL_OPERATORS: OperatorName[] = [
  'Copec Voltex',
  'Enel X Way',
  'Enex E-Pro',
  'Tesla',
  'SAESA',
  'Chilquinta',
  'CGE',
  'BMW',
  'Otro',
];

export function ChargerFilterPopover({
  active,
  count,
  totalCount,
  filters,
  onActiveChange,
  onFiltersChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const hasActiveFilters =
    filters.operators.size < ALL_OPERATORS.length ||
    filters.types.size < 2 ||
    filters.speeds.size < 3 ||
    filters.teslaOnly;

  const toggleOperator = (op: OperatorName) => {
    const next = new Set(filters.operators);
    if (next.has(op)) next.delete(op);
    else next.add(op);
    onFiltersChange({ ...filters, operators: next });
  };

  const toggleType = (type: 'DC' | 'AC') => {
    const next = new Set(filters.types);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onFiltersChange({ ...filters, types: next });
  };

  const toggleSpeed = (speed: 'ultra' | 'fast' | 'slow') => {
    const next = new Set(filters.speeds);
    if (next.has(speed)) next.delete(speed);
    else next.add(speed);
    onFiltersChange({ ...filters, speeds: next });
  };

  const resetFilters = () => {
    onFiltersChange({
      operators: new Set(ALL_OPERATORS),
      types: new Set(['DC', 'AC']),
      speeds: new Set(['ultra', 'fast', 'slow']),
      teslaOnly: false,
    });
  };

  return (
    <div className="flex shrink-0">
      {/* Botón principal del pill */}
      <button
        onClick={() => onActiveChange(!active)}
        className={`flex items-center gap-1.5 rounded-l-full pl-3 pr-2 py-2 text-xs font-semibold transition-all active:scale-95 shadow-md ${
          active
            ? 'bg-primary text-primary-foreground shadow-primary/40'
            : 'glass hover:bg-card/95'
        }`}
      >
        <span className="text-sm">⚡</span>
        <span>Cargadores</span>
        {active && (
          <Badge variant="primary" className="ml-1">
            {count !== totalCount ? `${count}/${totalCount}` : count}
          </Badge>
        )}
      </button>

      {/* Botón de filtros */}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            className={`flex items-center gap-0.5 rounded-r-full pr-2.5 pl-1.5 py-2 text-xs font-semibold transition-all active:scale-95 shadow-md border-l ${
              active
                ? 'bg-primary text-primary-foreground shadow-primary/40 border-primary-foreground/20'
                : 'glass hover:bg-card/95 border-border/50'
            } ${hasActiveFilters && active ? 'ring-2 ring-amber-400/60' : ''}`}
            title="Filtros de cargadores"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            />
            {hasActiveFilters && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            )}
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            align="start"
            className="z-[60] w-72 rounded-2xl border border-border bg-card p-4 shadow-2xl outline-none"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  <Filter className="h-4 w-4 text-primary" />
                  Filtros de cargadores
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-[10px] uppercase tracking-wider font-semibold text-primary hover:underline"
                  >
                    Restablecer
                  </button>
                )}
              </div>

              {/* Compatibilidad Tesla */}
              <label className="flex items-center justify-between rounded-lg p-2 hover:bg-muted/50 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚗</span>
                  <span className="text-sm font-semibold">Solo compatibles Tesla</span>
                </div>
                <input
                  type="checkbox"
                  checked={filters.teslaOnly}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, teslaOnly: e.target.checked })
                  }
                  className="h-4 w-4 accent-primary"
                />
              </label>

              {/* Tipo */}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
                  Tipo de carga
                </div>
                <div className="flex gap-1">
                  <FilterChip
                    active={filters.types.has('DC')}
                    onClick={() => toggleType('DC')}
                    color="emerald"
                  >
                    ⚡ DC (rápida)
                  </FilterChip>
                  <FilterChip
                    active={filters.types.has('AC')}
                    onClick={() => toggleType('AC')}
                    color="slate"
                  >
                    🔌 AC (lenta)
                  </FilterChip>
                </div>
              </div>

              {/* Velocidad */}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
                  Velocidad
                </div>
                <div className="flex gap-1 flex-wrap">
                  <FilterChip
                    active={filters.speeds.has('ultra')}
                    onClick={() => toggleSpeed('ultra')}
                    color="emerald"
                  >
                    Ultra ≥150kW
                  </FilterChip>
                  <FilterChip
                    active={filters.speeds.has('fast')}
                    onClick={() => toggleSpeed('fast')}
                    color="emerald"
                  >
                    Rápida 50-149kW
                  </FilterChip>
                  <FilterChip
                    active={filters.speeds.has('slow')}
                    onClick={() => toggleSpeed('slow')}
                    color="slate"
                  >
                    Lenta &lt;50kW
                  </FilterChip>
                </div>
              </div>

              {/* Operadores */}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
                  Operadores ({filters.operators.size}/{ALL_OPERATORS.length})
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {ALL_OPERATORS.map((op) => {
                    const checked = filters.operators.has(op);
                    return (
                      <label
                        key={op}
                        className="flex items-center justify-between gap-2 rounded-lg p-1.5 hover:bg-muted/50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className="grid h-5 w-5 shrink-0 place-items-center rounded text-white text-[9px] font-bold"
                            style={{ background: OPERATOR_COLORS[op] }}
                          >
                            {OPERATOR_INITIALS[op]}
                          </span>
                          <span className="text-xs truncate">{op}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOperator(op)}
                          className="h-4 w-4 accent-primary shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: 'emerald' | 'slate';
  children: React.ReactNode;
}) {
  const activeColors = {
    emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
    slate: 'bg-secondary border-border text-foreground',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-95 ${
        active ? activeColors[color] : 'border-border/40 text-muted-foreground'
      }`}
    >
      {active && <Check className="h-2.5 w-2.5" />}
      {children}
    </button>
  );
}

export const DEFAULT_CHARGER_FILTERS: ChargerFilters = {
  operators: new Set(ALL_OPERATORS),
  types: new Set(['DC', 'AC']),
  speeds: new Set(['ultra', 'fast', 'slow']),
  teslaOnly: false,
};
