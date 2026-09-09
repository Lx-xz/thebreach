'use client';

import { useEffect, useState } from 'react';

export interface TocItem {
  id: string;
  label: string;
  level: 2 | 3;
}

/** Sumário da página, com destaque da seção visível. */
export function Toc({ items, title = 'Nesta página' }: { items: TocItem[]; title?: string }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

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
    <nav className="toc" aria-label={title}>
      <p className="toc__title">{title}</p>
      <ul className="toc__list">
        {items.map((item) => (
          <li key={item.id}>
            <a
              className={`toc__link${item.level === 3 ? ' toc__link--sub' : ''}`}
              href={`#${item.id}`}
              data-active={active === item.id}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
