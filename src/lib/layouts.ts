/** Preferências de aparência guardadas no navegador. */

export type ThemeId = 'light' | 'dark';
export const DEFAULT_THEME: ThemeId = 'light';

/** Como a navegação lateral se comporta em telas largas. */
export type NavMode = 'pinned' | 'floating';
export const DEFAULT_NAV: NavMode = 'pinned';

/** A lateral direita — tema e repositório — aberta com rótulos ou recolhida. */
export type ToolsMode = 'open' | 'closed';
export const DEFAULT_TOOLS: ToolsMode = 'closed';

export const STORAGE_KEYS = {
  theme: 'breach:theme',
  nav: 'breach:nav',
  tools: 'breach:tools',
} as const;

export function isNavMode(value: unknown): value is NavMode {
  return value === 'pinned' || value === 'floating';
}

export function isToolsMode(value: unknown): value is ToolsMode {
  return value === 'open' || value === 'closed';
}

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
