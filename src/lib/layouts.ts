/** Os quatro layouts oferecidos. O id vai para `data-layout` no <html>. */

export const LAYOUT_IDS = ['grimorio', 'codice', 'atlas', 'escriba'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export const DEFAULT_LAYOUT: LayoutId = 'grimorio';

export type ThemeId = 'light' | 'dark';
export const DEFAULT_THEME: ThemeId = 'light';

export interface LayoutOption {
  id: LayoutId;
  name: string;
  tagline: string;
  description: string;
  /** Ícone lucide, resolvido no componente. */
  icon: 'BookOpen' | 'PanelsTopLeft' | 'LayoutGrid' | 'Feather';
  traits: string[];
}

export const LAYOUTS: LayoutOption[] = [
  {
    id: 'grimorio',
    name: 'Grimório',
    tagline: 'o tomo',
    description:
      'A folha de pergaminho emoldurada, com serifa, versalete, capitular na abertura e filetes ornamentais entre as seções. É o layout que mais lembra um livro de mesa impresso.',
    icon: 'BookOpen',
    traits: ['Serifa e versalete', 'Página emoldurada', 'Capitular e fleurões', 'Sumário no corpo'],
  },
  {
    id: 'codice',
    name: 'Códice',
    tagline: 'a documentação',
    description:
      'Três colunas: árvore de categorias fixa à esquerda, leitura ao centro, sumário fixo à direita. Metadados em ficha técnica. Denso, rápido de varrer, sem ornamento.',
    icon: 'PanelsTopLeft',
    traits: ['Árvore lateral fixa', 'Sumário acompanhando', 'Ficha técnica de metadados', 'Sem serifa'],
  },
  {
    id: 'atlas',
    name: 'Atlas',
    tagline: 'o mosaico',
    description:
      'A navegação é o próprio conteúdo: cartões grandes, uma cor pastel por categoria e muito ar. Cada seção do documento vira um cartão sobre um fundo em degradê.',
    icon: 'LayoutGrid',
    traits: ['Mosaico de cartões', 'Cor por categoria', 'Cantos arredondados', 'Sem barra lateral'],
  },
  {
    id: 'escriba',
    name: 'Escriba',
    tagline: 'o manuscrito',
    description:
      'Editorial mínimo. Uma coluna estreita, tipografia grande, sem moldura, sem cartão, sem sumário. Selos de confiabilidade em contorno discreto. O texto manda.',
    icon: 'Feather',
    traits: ['Coluna única estreita', 'Display grande', 'Zero cromo', 'Selos em contorno'],
  },
];

export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === 'string' && (LAYOUT_IDS as readonly string[]).includes(value);
}

export const STORAGE_KEYS = {
  layout: 'breach:layout',
  theme: 'breach:theme',
} as const;

/** Cor pastel de destaque de cada categoria, usada nos cartões. */
export const CATEGORY_ACCENTS: Record<string, string> = {
  cosmologia: 'var(--peri)',
  geografia: 'var(--sage)',
  povos: 'var(--amber)',
  bestiario: 'var(--rose)',
  forcas: 'var(--lilac)',
  historia: 'var(--teal)',
  instituicoes: 'var(--peri)',
  artefatos: 'var(--amber)',
  narrativas: 'var(--sage)',
};

export function accentFor(slug: string): string {
  return CATEGORY_ACCENTS[slug] ?? 'var(--accent)';
}
