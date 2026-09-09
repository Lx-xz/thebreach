'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, Feather, LayoutGrid, PanelsTopLeft, Shapes } from 'lucide-react';
import { LAYOUTS, type LayoutOption } from '@/lib/layouts';
import { useAppearance } from './AppearanceProvider';

const ICONS = { BookOpen, PanelsTopLeft, LayoutGrid, Feather } as const;

/** Miniatura esquemática do layout, desenhada só com grid. */
export function LayoutThumb({ id }: { id: LayoutOption['id'] }) {
  const bars = id === 'atlas' ? 7 : id === 'codice' ? 4 : id === 'grimorio' ? 2 : 3;
  return (
    <span className={`thumb thumb--${id}`} aria-hidden="true">
      <em />
      {Array.from({ length: bars }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
}

export function LayoutSwitcher() {
  const { layout, setLayout } = useAppearance();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent): void => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const current = LAYOUTS.find((option) => option.id === layout) ?? LAYOUTS[0];

  return (
    <div className="switcher" ref={container}>
      <button
        type="button"
        className="tool tool--wide"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        title="Trocar o layout do site"
      >
        <Shapes size={17} aria-hidden="true" />
        <span>{current.name}</span>
      </button>

      {open ? (
        <div className="switcher__panel" role="dialog" aria-label="Escolher layout">
          <p className="switcher__hint">
            Quatro peles sobre o mesmo acervo. A escolha fica guardada neste navegador.
          </p>
          {LAYOUTS.map((option) => {
            const Icon = ICONS[option.icon];
            const active = option.id === layout;
            return (
              <button
                key={option.id}
                type="button"
                className="switcher__option"
                aria-pressed={active}
                onClick={() => {
                  setLayout(option.id);
                  setOpen(false);
                }}
              >
                <span className="switcher__glyph">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span>
                  <span className="switcher__name">{option.name}</span>
                  <span className="switcher__desc">{option.description}</span>
                </span>
                {active ? <Check size={16} aria-hidden="true" /> : <span />}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
