'use client';

import { BookOpen, Check, Feather, LayoutGrid, PanelsTopLeft } from 'lucide-react';
import { LAYOUTS } from '@/lib/layouts';
import { useAppearance } from './AppearanceProvider';
import { LayoutThumb } from './LayoutSwitcher';

const ICONS = { BookOpen, PanelsTopLeft, LayoutGrid, Feather } as const;

/** Grade de escolha dos quatro layouts, com miniatura e descrição. */
export function LayoutPicker({ detailed = false }: { detailed?: boolean }) {
  const { layout, setLayout } = useAppearance();

  return (
    <div className="picker">
      {LAYOUTS.map((option) => {
        const Icon = ICONS[option.icon];
        const active = option.id === layout;
        return (
          <button
            key={option.id}
            type="button"
            className="picker__card"
            aria-pressed={active}
            onClick={() => setLayout(option.id)}
          >
            <LayoutThumb id={option.id} />
            <span className="picker__head">
              <Icon size={16} aria-hidden="true" />
              <span className="picker__name">{option.name}</span>
              <span className="picker__tagline">{option.tagline}</span>
              {active ? (
                <span className="picker__badge">
                  <Check size={12} aria-hidden="true" /> em uso
                </span>
              ) : null}
            </span>
            <span className="picker__desc">{option.description}</span>
            {detailed ? (
              <span className="picker__traits">
                {option.traits.map((trait) => (
                  <span className="chip" key={trait}>
                    {trait}
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
