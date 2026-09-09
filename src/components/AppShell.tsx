'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronRight, Github, Moon, Pin, PinOff, PanelLeft, Search as SearchIcon, Sun, X,
} from 'lucide-react';
import type { SearchRecord } from '@/lib/breach/types';
import { useAppearance } from './AppearanceProvider';
import { SearchDialog } from './SearchDialog';
import { Sigil } from './Sigil';

/** Uma entidade na navegação, com as entidades contidas nela. */
export interface NavDoc {
  slug: string;
  title: string;
  children: NavDoc[];
}

export interface NavCategory {
  slug: string;
  number: string;
  title: string;
  count: number;
  docs: NavDoc[];
}

const CHAVE_ABERTOS = 'breach:navegacao-aberta';

/**
 * Caminhos que precisam estar abertos para que a página atual apareça na
 * árvore: `/c/bestiario`, `/c/bestiario/dragoes`, e assim por diante.
 */
function ancestrais(pathname: string): string[] {
  const partes = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (partes[0] !== 'c') return [];
  const saida: string[] = [];
  for (let i = 2; i <= partes.length; i += 1) saida.push(`/${partes.slice(0, i).join('/')}`);
  return saida;
}

/**
 * Onde a linha da árvore está em relação à página aberta: ela mesma, ou um
 * galho que contém a página. Marcar só a igualdade exata deixava a árvore muda
 * dentro de qualquer subpágina.
 */
type Estado = 'atual' | 'caminho' | undefined;

function estadoDe(pathname: string, href: string): Estado {
  const aqui = pathname.replace(/\/+$/, '');
  if (aqui === href) return 'atual';
  if (aqui.startsWith(`${href}/`)) return 'caminho';
  return undefined;
}

/**
 * A chave que abre e fecha um galho.
 *
 * É botão separado do link de propósito: o nome leva ao documento, a chave só
 * mostra o que há dentro. Sem isso, ver o conteúdo de uma pasta obrigaria a
 * navegar até ela.
 */
function Chave({
  aberto,
  rotulo,
  alternar,
}: {
  aberto: boolean;
  rotulo: string;
  alternar: () => void;
}) {
  return (
    <button
      type="button"
      className="railnav__chave"
      aria-expanded={aberto}
      aria-label={`${aberto ? 'Recolher' : 'Abrir'} ${rotulo}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        alternar();
      }}
    >
      <ChevronRight size={13} aria-hidden="true" />
    </button>
  );
}

/** Entidades da categoria, aninhadas como estão no acervo. */
function NavDocs({
  docs,
  base,
  pathname,
  abertos,
  alternar,
}: {
  docs: NavDoc[];
  base: string;
  pathname: string;
  abertos: Set<string>;
  alternar: (chave: string) => void;
}) {
  return (
    <ul className="railnav__sub">
      {docs.map((doc) => {
        const docHref = `${base}/${doc.slug}`;
        const temFilhos = doc.children.length > 0;
        const aberto = abertos.has(docHref);
        const estado = estadoDe(pathname, docHref);
        return (
          <li key={doc.slug}>
            <span className="railnav__linha" data-estado={estado}>
              {temFilhos ? (
                <Chave aberto={aberto} rotulo={doc.title} alternar={() => alternar(docHref)} />
              ) : (
                <span className="railnav__chave railnav__chave--vazia" aria-hidden="true" />
              )}
              <Link
                className="railnav__sublink"
                href={docHref}
                aria-current={estado === 'atual' ? 'page' : undefined}
              >
                {doc.title}
              </Link>
            </span>
            {temFilhos && aberto ? (
              <NavDocs
                docs={doc.children}
                base={base}
                pathname={pathname}
                abertos={abertos}
                alternar={alternar}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

interface Props {
  nav: NavCategory[];
  searchRecords: SearchRecord[];
  repoUrl: string;
  children: React.ReactNode;
}

const MAIN_LINKS = [
  { href: '/compendio', label: 'Índice canônico' },
  { href: '/alteracoes', label: 'Alterações' },
  { href: '/convencoes', label: 'Convenções' },
];

/** Acompanha uma media query sem divergir na hidratação. */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 72rem)');
    const sync = (): void => setWide(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return wide;
}

export function AppShell({ nav, searchRecords, repoUrl, children }: Props) {
  const pathname = usePathname();
  const { theme, toggleTheme, nav: navMode, setNav, drawer, setDrawer } = useAppearance();
  const [search, setSearch] = useState(false);
  const wide = useWide();

  // Começa vazio nos dois lados para a hidratação não divergir; o que estava
  // guardado entra depois, junto com os ancestrais da página atual.
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const carregado = useRef(false);

  useEffect(() => {
    let guardado: string[] = [];
    try {
      guardado = JSON.parse(localStorage.getItem(CHAVE_ABERTOS) ?? '[]');
    } catch {
      guardado = [];
    }
    setAbertos(new Set([...guardado, ...ancestrais(pathname)]));
    carregado.current = true;
    // Só na montagem: a partir daí o efeito seguinte cuida da navegação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navegar revela o caminho até a página, sem fechar o que o leitor abriu.
  useEffect(() => {
    setAbertos((atual) => {
      const novo = new Set(atual);
      let mudou = false;
      for (const chave of ancestrais(pathname)) {
        if (!novo.has(chave)) {
          novo.add(chave);
          mudou = true;
        }
      }
      return mudou ? novo : atual;
    });
  }, [pathname]);

  useEffect(() => {
    if (!carregado.current) return;
    try {
      localStorage.setItem(CHAVE_ABERTOS, JSON.stringify([...abertos]));
    } catch {
      /* sem armazenamento: a árvore ainda funciona, só não lembra. */
    }
  }, [abertos]);

  const alternar = useCallback((chave: string) => {
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(chave)) novo.add(chave);
      return novo;
    });
  }, []);

  /** Barra lateral ocupando espaço próprio, sem cobrir o conteúdo. */
  const railFixed = wide && navMode === 'pinned';

  useEffect(() => {
    setDrawer(false);
  }, [pathname, setDrawer]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing) return;
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Fixada, o botão do cabeçalho recolhe; solta, abre e fecha a gaveta.
  const toggleNav = (): void => {
    if (railFixed) {
      setNav('floating');
      setDrawer(false);
      return;
    }
    setDrawer(!drawer);
  };

  const togglePin = (): void => {
    setNav(navMode === 'pinned' ? 'floating' : 'pinned');
    setDrawer(false);
  };

  return (
    <div className="app">
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>

      <header className="masthead">
        <div className="masthead__inner">
          <button
            type="button"
            className="tool tool--nav"
            aria-label={railFixed ? 'Recolher a navegação' : drawer ? 'Fechar a navegação' : 'Abrir a navegação'}
            aria-expanded={railFixed || drawer}
            onClick={toggleNav}
          >
            <PanelLeft size={19} aria-hidden="true" />
          </button>

          <Link className="brand" href="/">
            <span className="brand__mark">
              <Sigil />
            </span>
            <span className="brand__text">
              <span className="brand__name">Compêndio Breach</span>
              <span className="brand__tag">acervo de um universo em construção</span>
            </span>
          </Link>

          <div className="tools">
            <button
              type="button"
              className="tool tool--wide"
              onClick={() => setSearch(true)}
              aria-label="Buscar no acervo"
            >
              <SearchIcon size={17} aria-hidden="true" />
              <span>Buscar</span>
              <kbd>/</kbd>
            </button>
          </div>
        </div>
      </header>

      {/* A segunda lateral. A da esquerda é o acervo; esta é o aparelho — tema
          e repositório. Os três links de meta saíram daqui de cima porque já
          estão na navegação, e repetidos só faziam ruído. */}
      <aside className="utilrail" aria-label="Ferramentas do site">
        <button
          type="button"
          className="utilrail__tool"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
        >
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
        <a
          className="utilrail__tool"
          href={repoUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Ver o acervo no GitHub"
          title="Ver o acervo no GitHub"
        >
          <Github size={18} aria-hidden="true" />
        </a>
      </aside>

      <div className="frame">
        <aside className="railnav" data-open={drawer} aria-label="Categorias do acervo">
          <div className="railnav__bar">
            <span className="railnav__label">Navegação</span>
            <button
              type="button"
              className="railnav__pin"
              onClick={togglePin}
              aria-pressed={navMode === 'pinned'}
              title={navMode === 'pinned' ? 'Soltar a barra lateral' : 'Fixar a barra lateral aberta'}
            >
              {navMode === 'pinned' ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
              <span className="sr-only">
                {navMode === 'pinned' ? 'Soltar a barra lateral' : 'Fixar a barra lateral aberta'}
              </span>
            </button>
            <button
              type="button"
              className="railnav__close"
              onClick={() => setDrawer(false)}
              aria-label="Fechar a navegação"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="railnav__group">
            <p className="railnav__title">Categorias</p>
            <ul className="railnav__list">
              {nav.map((category) => {
                const href = `/c/${category.slug}`;
                const temDocs = category.docs.length > 0;
                const aberto = abertos.has(href);
                const estado = estadoDe(pathname, href);
                return (
                  <li key={category.slug}>
                    <span className="railnav__linha" data-estado={estado}>
                      {temDocs ? (
                        <Chave
                          aberto={aberto}
                          rotulo={category.title}
                          alternar={() => alternar(href)}
                        />
                      ) : (
                        <span className="railnav__chave railnav__chave--vazia" aria-hidden="true" />
                      )}
                      <Link
                        className="railnav__item"
                        href={href}
                        aria-current={estado === 'atual' ? 'page' : undefined}
                      >
                        <span className="railnav__num">{category.number}</span>
                        <span>{category.title}</span>
                        <span className="railnav__count">{category.count || '—'}</span>
                      </Link>
                    </span>
                    {temDocs && aberto ? (
                      <NavDocs
                        docs={category.docs}
                        base={href}
                        pathname={pathname}
                        abertos={abertos}
                        alternar={alternar}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="railnav__group">
            <p className="railnav__title">Meta</p>
            <ul className="railnav__list">
              {MAIN_LINKS.map((link) => (
                <li key={link.href}>
                  <span className="railnav__linha" data-estado={estadoDe(pathname, link.href)}>
                    <span className="railnav__chave railnav__chave--vazia" aria-hidden="true" />
                    <Link
                      className="railnav__item"
                      href={link.href}
                      aria-current={estadoDe(pathname, link.href) === 'atual' ? 'page' : undefined}
                    >
                      <span>{link.label}</span>
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {drawer ? (
          <button type="button" className="scrim" aria-label="Fechar a navegação" onClick={() => setDrawer(false)} />
        ) : null}

        <main className="main" id="conteudo">
          {children}
        </main>
      </div>

      <footer className="colophon">
        <div className="colophon__inner">
          <div>
            <p className="colophon__title">Compêndio Breach</p>
            <p>
              Representação visual do acervo. Todo o conteúdo vem do repositório{' '}
              <a href={repoUrl} target="_blank" rel="noreferrer noopener">
                Lx-xz/breach
              </a>
              , lido como banco de dados durante a publicação.
            </p>
          </div>
          <div>
            <p className="colophon__title">Navegar</p>
            <ul className="colophon__list">
              {MAIN_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="colophon__title">Categorias</p>
            <ul className="colophon__list">
              {nav.slice(0, 5).map((category) => (
                <li key={category.slug}>
                  <Link href={`/c/${category.slug}`}>{category.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>

      <SearchDialog records={searchRecords} open={search} onClose={() => setSearch(false)} />
    </div>
  );
}
