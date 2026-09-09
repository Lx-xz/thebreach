'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Github, Moon, Pin, PinOff, PanelLeft, Search as SearchIcon, Sun, X } from 'lucide-react';
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

/** Entidades da categoria, aninhadas como estão no acervo. */
function NavDocs({
  docs,
  base,
  pathname,
}: {
  docs: NavDoc[];
  base: string;
  pathname: string;
}) {
  return (
    <ul className="railnav__sub">
      {docs.map((doc) => {
        const docHref = `${base}/${doc.slug}`;
        return (
          <li key={doc.slug}>
            <Link
              className="railnav__sublink"
              href={docHref}
              aria-current={pathname === docHref || pathname === `${docHref}/` ? 'page' : undefined}
            >
              {doc.title}
            </Link>
            {doc.children.length > 0 ? (
              <NavDocs docs={doc.children} base={base} pathname={pathname} />
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

  const isActive = (href: string): boolean =>
    pathname === href || pathname === `${href}/` || pathname.startsWith(`${href}/`);

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

          <nav className="mainnav" aria-label="Seções do site">
            {MAIN_LINKS.map((link) => (
              <Link
                key={link.href}
                className="mainnav__link"
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

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
            <button
              type="button"
              className="tool"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            >
              {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <a
              className="tool tool--repo"
              href={repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Ver o acervo no GitHub"
            >
              <Github size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

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
                const open = isActive(href);
                return (
                  <li key={category.slug}>
                    <Link
                      className="railnav__item"
                      href={href}
                      aria-current={pathname === href || pathname === `${href}/` ? 'page' : undefined}
                    >
                      <span className="railnav__num">{category.number}</span>
                      <span>{category.title}</span>
                      <span className="railnav__count">{category.count || '—'}</span>
                    </Link>
                    {open && category.docs.length > 0 ? (
                      <NavDocs docs={category.docs} base={href} pathname={pathname} />
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
                  <Link
                    className="railnav__item"
                    href={link.href}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                  >
                    <span>{link.label}</span>
                  </Link>
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
