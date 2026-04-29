'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SegmentedProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string; sublabel?: string }>;
  className?: string;
}

export function Segmented({ value, onValueChange, options, className }: SegmentedProps) {
  return (
    <div
      className={cn(
        'inline-flex rounded-xl bg-secondary p-1 gap-0.5 w-full',
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onValueChange(opt.value)}
          className={cn(
            'flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-all',
            'flex flex-col items-center justify-center gap-0.5',
            value === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span>{opt.label}</span>
          {opt.sublabel && (
            <span className="text-[9px] opacity-70 font-medium">{opt.sublabel}</span>
          )}
        </button>
      ))}
    </div>
  );
}
