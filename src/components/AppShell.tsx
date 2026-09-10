'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronRight, Github, Moon, PanelLeft, PanelRight, Pin, PinOff, Search as SearchIcon, Sun, X,
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
function useMedia(consulta: string): boolean {
  const [bate, setBate] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(consulta);
    const sync = (): void => setBate(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [consulta]);
  return bate;
}

/**
 * Um gesto que começa dentro de algo que rola na horizontal — uma tabela larga,
 * um bloco de código — pertence àquilo, não à casca.
 */
function dentroDeRolagemHorizontal(alvo: EventTarget | null): boolean {
  let no = alvo instanceof Element ? alvo : null;
  while (no && no !== document.body) {
    if (no.scrollWidth > no.clientWidth + 1) {
      const overflow = getComputedStyle(no).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
    no = no.parentElement;
  }
  return false;
}

/** O que separa um gesto de um toque à toa: distância, pressa e retidão. */
const GESTO = { alcance: 64, tempo: 700, retidao: 1.8 } as const;

export function AppShell({ nav, searchRecords, repoUrl, children }: Props) {
  const pathname = usePathname();
  const { theme, toggleTheme, nav: navMode, setNav, drawer, setDrawer, tools, toggleTools } =
    useAppearance();
  const [search, setSearch] = useState(false);
  const wide = useMedia('(min-width: 72rem)');
  // Abaixo disso a tela é de dedo, e as laterais respondem ao arrasto.
  const estreito = !useMedia('(min-width: 48rem)');

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

  // Duas gavetas abertas ao mesmo tempo não fazem sentido: abrir uma fecha a
  // outra.
  const abrirNavegacao = useCallback(() => {
    if (tools === 'open') toggleTools();
    setDrawer(true);
  }, [tools, toggleTools, setDrawer]);

  const abrirFerramentas = useCallback(() => {
    setDrawer(false);
    if (tools !== 'open') toggleTools();
  }, [tools, toggleTools, setDrawer]);

  /**
   * No telefone as laterais também respondem ao dedo: arrastar para a direita
   * traz a navegação, para a esquerda traz as ferramentas, e o gesto contrário
   * fecha a que estiver aberta.
   *
   * Nada de `preventDefault` aqui — a página tem de continuar rolando na
   * vertical enquanto o dedo anda. O que separa um gesto de uma rolagem é a
   * direção: só conta o que anda bem mais na horizontal do que na vertical.
   */
  useEffect(() => {
    if (!estreito) return undefined;

    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let valendo = false;

    const comecar = (event: TouchEvent): void => {
      if (event.touches.length !== 1) {
        valendo = false;
        return;
      }
      const toque = event.touches[0];
      x0 = toque.clientX;
      y0 = toque.clientY;
      t0 = Date.now();
      valendo = !dentroDeRolagemHorizontal(event.target);
    };

    const terminar = (event: TouchEvent): void => {
      if (!valendo) return;
      valendo = false;
      const toque = event.changedTouches[0];
      if (!toque) return;

      const dx = toque.clientX - x0;
      const dy = toque.clientY - y0;
      if (Date.now() - t0 > GESTO.tempo) return;
      if (Math.abs(dx) < GESTO.alcance) return;
      if (Math.abs(dx) < Math.abs(dy) * GESTO.retidao) return;

      const ferramentasAbertas = tools === 'open';
      if (dx > 0) {
        if (ferramentasAbertas) toggleTools();
        else if (!drawer) abrirNavegacao();
        return;
      }
      if (drawer) setDrawer(false);
      else if (!ferramentasAbertas) abrirFerramentas();
    };

    const cancelar = (): void => {
      valendo = false;
    };

    document.addEventListener('touchstart', comecar, { passive: true });
    document.addEventListener('touchend', terminar, { passive: true });
    document.addEventListener('touchcancel', cancelar, { passive: true });
    return () => {
      document.removeEventListener('touchstart', comecar);
      document.removeEventListener('touchend', terminar);
      document.removeEventListener('touchcancel', cancelar);
    };
  }, [estreito, drawer, tools, toggleTools, setDrawer, abrirNavegacao, abrirFerramentas]);

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
    if (drawer) setDrawer(false);
    else abrirNavegacao();
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
            <button
              type="button"
              className="tool tool--tools"
              onClick={() => (tools === 'open' ? toggleTools() : abrirFerramentas())}
              aria-label={tools === 'open' ? 'Fechar as ferramentas' : 'Abrir as ferramentas'}
              aria-expanded={tools === 'open'}
            >
              <PanelRight size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* A segunda lateral. A da esquerda é o acervo; esta é o aparelho — tema
          e repositório. Os três links de meta saíram daqui de cima porque já
          estão na navegação, e repetidos só faziam ruído.

          Como a da esquerda, abre e fecha: recolhida é uma faixa de ícones,
          aberta mostra os rótulos. */}
      <aside className="utilrail" aria-label="Ferramentas do site">
        <div className="utilrail__bar">
          <p className="utilrail__label">Ferramentas</p>
          <button
            type="button"
            className="utilrail__chave"
            onClick={toggleTools}
            aria-expanded={tools === 'open'}
            aria-label={tools === 'open' ? 'Recolher as ferramentas' : 'Abrir as ferramentas'}
            title={tools === 'open' ? 'Recolher as ferramentas' : 'Abrir as ferramentas'}
          >
            <PanelRight size={17} aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className="utilrail__tool"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
        >
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          <span className="utilrail__nome">{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
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
          <span className="utilrail__nome">No GitHub</span>
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

        {tools === 'open' ? (
          <button
            type="button"
            className="scrim"
            aria-label="Fechar as ferramentas"
            onClick={toggleTools}
          />
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
