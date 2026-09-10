'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronRight, Github, Moon, PanelLeft, PanelRight, Pin, PinOff, Search as SearchIcon, Sun, X,
} from 'lucide-react';
import type { SearchRecord } from '@/lib/breach/types';
import { LARGO, useMedia } from '@/lib/media';
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

/**
 * Ajustes do arrasto.
 *  `retidao`  — quanto o dedo tem de andar mais na horizontal do que na
 *               vertical para o gesto ser das gavetas e não da rolagem.
 *  `acordar`  — deslocamento a partir do qual se decide de quem é o gesto.
 *  `virada`   — fração da gaveta a partir da qual soltar completa a abertura.
 *  `piparote` — abaixo deste tempo o gesto vale pela direção, não pela
 *               distância: um peteleco rápido abre mesmo sem ter ido longe.
 *  `assentar` — o quanto a animação do CSS leva; passado isso o inline sai.
 */
const ARRASTO = { retidao: 1.8, acordar: 12, virada: 0.45, piparote: 320, assentar: 340 } as const;

type Lado = 'nav' | 'ferramentas';

export function AppShell({ nav, searchRecords, repoUrl, children }: Props) {
  const pathname = usePathname();
  const { theme, toggleTheme, nav: navMode, setNav, drawer, setDrawer, tools, toggleTools } =
    useAppearance();
  const [search, setSearch] = useState(false);
  const wide = useMedia('(min-width: 72rem)');
  // Abaixo disso a tela é de dedo, e as laterais respondem ao arrasto.
  const estreito = !useMedia(LARGO);

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

  // Enquanto o dedo arrasta, a gaveta é movida direto no DOM: passar 60 quadros
  // por segundo pelo React redesenharia a árvore inteira da navegação a cada
  // pixel. O estado só entra no fim, para dizer onde ela parou.
  const navRef = useRef<HTMLElement>(null);
  const ferrRef = useRef<HTMLElement>(null);
  const veuRef = useRef<HTMLButtonElement>(null);
  const [arrastando, setArrastando] = useState<Lado | null>(null);
  const assentar = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(assentar.current), []);

  /**
   * No telefone as laterais acompanham o dedo: arrastar para a direita traz a
   * navegação, para a esquerda traz as ferramentas, e a gaveta anda junto do
   * movimento em vez de saltar quando ele acaba. Ao soltar, ela completa a
   * abertura ou volta, conforme o quanto andou — ou conforme a direção, se o
   * gesto foi um peteleco rápido.
   *
   * Nada de `preventDefault` aqui: a página tem de continuar rolando na
   * vertical enquanto o dedo anda. O que separa um gesto do outro é a direção.
   */
  useEffect(() => {
    if (!estreito) return undefined;

    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let elegivel = false;
    let lado: Lado | null = null;
    let inicio = 0;
    let largura = 1;
    let progresso = 0;

    const noDe = (qual: Lado): HTMLElement | null =>
      qual === 'nav' ? navRef.current : ferrRef.current;

    /** Fora da tela, em porcentagem da própria largura. */
    const foraDe = (qual: Lado): number => (qual === 'nav' ? -102 : 102);

    /** De quem é o gesto, e de que ponto ele parte. */
    const escolher = (dx: number): { lado: Lado; inicio: number } | null => {
      const ferramentasAbertas = tools === 'open';
      if (dx > 0) {
        if (ferramentasAbertas) return { lado: 'ferramentas', inicio: 1 };
        if (!drawer) return { lado: 'nav', inicio: 0 };
        return null;
      }
      if (drawer) return { lado: 'nav', inicio: 1 };
      if (!ferramentasAbertas) return { lado: 'ferramentas', inicio: 0 };
      return null;
    };

    const pintar = (qual: Lado, p: number): void => {
      const no = noDe(qual);
      if (no) {
        no.style.transition = 'none';
        no.style.transform = `translateX(${(1 - p) * foraDe(qual)}%)`;
      }
      if (veuRef.current) {
        veuRef.current.style.transition = 'none';
        veuRef.current.style.opacity = String(p);
      }
    };

    /**
     * Solta a gaveta no destino. O inline continua mandando durante a
     * animação — devolver o controle ao CSS antes de o React escrever o novo
     * atributo faria a gaveta saltar de volta ao ponto de partida.
     */
    const soltar = (qual: Lado, abrir: boolean): void => {
      const no = noDe(qual);
      if (no) {
        no.style.transition = '';
        no.style.transform = `translateX(${abrir ? 0 : foraDe(qual)}%)`;
      }
      if (veuRef.current) {
        veuRef.current.style.transition = '';
        veuRef.current.style.opacity = abrir ? '1' : '0';
      }

      if (qual === 'nav') setDrawer(abrir);
      else if ((tools === 'open') !== abrir) toggleTools();

      window.clearTimeout(assentar.current);
      assentar.current = window.setTimeout(() => {
        if (no) no.style.transform = '';
        if (abrir && veuRef.current) veuRef.current.style.opacity = '';
        setArrastando(null);
      }, ARRASTO.assentar);
    };

    const comecar = (event: TouchEvent): void => {
      if (event.touches.length !== 1) {
        elegivel = false;
        return;
      }
      const toque = event.touches[0];
      x0 = toque.clientX;
      y0 = toque.clientY;
      t0 = Date.now();
      lado = null;
      progresso = 0;
      elegivel = !dentroDeRolagemHorizontal(event.target);
    };

    const mover = (event: TouchEvent): void => {
      if (!elegivel) return;
      const toque = event.touches[0];
      if (!toque) return;
      const dx = toque.clientX - x0;
      const dy = toque.clientY - y0;

      if (!lado) {
        if (Math.abs(dx) < ARRASTO.acordar) return;
        // Decidido de uma vez: se o dedo saiu na vertical, o gesto é da
        // rolagem e não volta a ser nosso no meio do caminho.
        if (Math.abs(dx) < Math.abs(dy) * ARRASTO.retidao) {
          elegivel = false;
          return;
        }
        // O dedo real nunca sai reto: se os primeiros pixels foram para cima ou
        // para baixo, o navegador já prendeu o gesto na rolagem e não solta
        // mais (o evento chega com `cancelable` falso). Disputar dali em diante
        // é o que fazia a gaveta andar com a página subindo junto — então aqui
        // se abre mão: ou é rolagem limpa, ou é arrasto limpo.
        if (!event.cancelable) {
          elegivel = false;
          return;
        }
        const escolha = escolher(dx);
        if (!escolha) {
          elegivel = false;
          return;
        }
        lado = escolha.lado;
        inicio = escolha.inicio;
        largura = noDe(lado)?.getBoundingClientRect().width || 1;
        window.clearTimeout(assentar.current);
        setArrastando(lado);
      }

      // Reivindicado o gesto, a página para de rolar: o dedo raramente anda
      // reto, e sem isto a leitura sobe ou desce junto com a gaveta. É por
      // causa desta linha que o `touchmove` não pode ser passivo.
      if (event.cancelable) event.preventDefault();

      const sentido = lado === 'nav' ? 1 : -1;
      progresso = Math.min(1, Math.max(0, inicio + (dx * sentido) / largura));
      pintar(lado, progresso);
    };

    const terminar = (event: TouchEvent): void => {
      const qual = lado;
      elegivel = false;
      lado = null;
      if (!qual) return;

      const toque = event.changedTouches[0];
      const dx = toque ? toque.clientX - x0 : 0;
      const avanco = dx * (qual === 'nav' ? 1 : -1);
      const piparote = Date.now() - t0 < ARRASTO.piparote && Math.abs(avanco) > 24;
      soltar(qual, piparote ? avanco > 0 : progresso > ARRASTO.virada);
    };

    const cancelar = (): void => {
      const qual = lado;
      elegivel = false;
      lado = null;
      if (qual) soltar(qual, inicio === 1);
    };

    document.addEventListener('touchstart', comecar, { passive: true });
    document.addEventListener('touchmove', mover, { passive: false });
    document.addEventListener('touchend', terminar, { passive: true });
    document.addEventListener('touchcancel', cancelar, { passive: true });
    return () => {
      document.removeEventListener('touchstart', comecar);
      document.removeEventListener('touchmove', mover);
      document.removeEventListener('touchend', terminar);
      document.removeEventListener('touchcancel', cancelar);
    };
  }, [estreito, drawer, tools, toggleTools, setDrawer]);

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
      <aside className="utilrail" ref={ferrRef} aria-label="Ferramentas do site">
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
        <aside className="railnav" ref={navRef} data-open={drawer} aria-label="Categorias do acervo">
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

        {/* Um véu só, para os dois lados: durante o arrasto ele precisa existir
            antes de a gaveta terminar de entrar, e dois véus empilhados
            escureceriam o dobro. */}
        {drawer || tools === 'open' || arrastando ? (
          <button
            type="button"
            ref={veuRef}
            className="scrim"
            data-visivel={drawer || tools === 'open'}
            aria-label={drawer ? 'Fechar a navegação' : 'Fechar as ferramentas'}
            onClick={() => {
              setDrawer(false);
              if (tools === 'open') toggleTools();
            }}
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
