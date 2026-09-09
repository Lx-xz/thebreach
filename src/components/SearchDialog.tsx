'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Fuse from 'fuse.js';
import { CornerDownLeft, Search as SearchIcon } from 'lucide-react';
import type { SearchRecord } from '@/lib/breach/types';

interface Props {
  records: SearchRecord[];
  open: boolean;
  onClose: () => void;
}

/**
 * Busca client-side sobre o índice gerado no build. O acervo é pequeno; o
 * índice inteiro viaja com a página e a busca é instantânea, sem servidor.
 */
export function SearchDialog({ records, open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(
    () =>
      new Fuse(records, {
        includeScore: true,
        threshold: 0.38,
        ignoreLocation: true,
        minMatchCharLength: 2,
        keys: [
          { name: 'title', weight: 0.45 },
          { name: 'headings', weight: 0.2 },
          { name: 'excerpt', weight: 0.2 },
          { name: 'categoria', weight: 0.1 },
          { name: 'body', weight: 0.05 },
        ],
      }),
    [records],
  );

  const results = useMemo(() => {
    const term = query.trim();
    if (!term) return records.slice(0, 8);
    return fuse.search(term, { limit: 12 }).map((hit) => hit.item);
  }, [fuse, query, records]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      // O foco só existe depois que o diálogo entra no DOM.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, results.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
      return;
    }
    if (event.key === 'Enter' && results[cursor]) {
      event.preventDefault();
      go(results[cursor].href);
    }
  };

  if (!open) return null;

  return (
    <div
      className="searchdialog"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="searchdialog__panel" role="dialog" aria-modal="true" aria-label="Buscar no acervo">
        <div className="searchdialog__field">
          <SearchIcon size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder="Buscar entidade, categoria, seção…"
            aria-label="Termo de busca"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>

        {results.length === 0 ? (
          <p className="searchdialog__foot">Nada no acervo corresponde a “{query}”.</p>
        ) : (
          <ul className="searchdialog__results">
            {results.map((record, index) => (
              <li key={record.href}>
                <a
                  className="searchresult"
                  href={record.href}
                  data-active={index === cursor}
                  onMouseEnter={() => setCursor(index)}
                  onClick={(event) => {
                    event.preventDefault();
                    go(record.href);
                  }}
                >
                  <span className="searchresult__top">
                    <span className="searchresult__title">{record.title}</span>
                    <span className="searchresult__cat">
                      {record.categoria}
                      {record.subtipo ? ` · ${record.subtipo}` : ''}
                    </span>
                  </span>
                  {record.excerpt ? <span className="searchresult__text">{record.excerpt}</span> : null}
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="searchdialog__foot">
          <span>
            <CornerDownLeft size={12} aria-hidden="true" /> abrir
          </span>
          <span>↑ ↓ navegar</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}
