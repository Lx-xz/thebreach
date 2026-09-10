'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { LARGO, useMedia } from '@/lib/media';

export interface TocItem {
  id: string;
  label: string;
  level: 2 | 3;
}

/** Sumário da página, com destaque da seção visível. */
export function Toc({ items, title = 'Nesta página' }: { items: TocItem[]; title?: string }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  // No celular o sumário nasce recolhido: aberto, ele custava 343px de tela
  // antes da primeira linha de texto. Em tela larga ele é coluna própria e não
  // atrapalha ninguém, então continua sempre aberto — quem decide é o CSS, e
  // este estado só serve para abrir o que está fechado.
  const [aberto, setAberto] = useState(false);
  const largo = useMedia(LARGO);

  useEffect(() => {
    const targets = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (targets.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // A faixa estreita no alto da tela evita que várias seções disputem o destaque.
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav className="toc" data-aberto={aberto} aria-label={title}>
      {largo ? (
        <p className="toc__title">{title}</p>
      ) : (
        <button
          type="button"
          className="toc__title toc__title--chave"
          aria-expanded={aberto}
          onClick={() => setAberto((valor) => !valor)}
        >
          <span>{title}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      )}
      <ul className="toc__list">
        {items.map((item) => (
          <li key={item.id}>
            <a
              className={`toc__link${item.level === 3 ? ' toc__link--sub' : ''}`}
              href={`#${item.id}`}
              data-active={active === item.id}
              onClick={() => setAberto(false)}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
