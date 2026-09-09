/** Slugs, rotas e mapeamento de caminho do repo para URL do site. */

export function deaccent(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function slugify(value: string): string {
  return deaccent(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Prefixa o basePath em href cru (dentro de HTML gerado do markdown). */
export function withBase(href: string): string {
  if (!href.startsWith('/')) return href;
  const normalized = href.endsWith('/') ? href : `${href}/`;
  return `${BASE_PATH}${normalized}`;
}

/** `04-bestiario` → `{ number: '04', slug: 'bestiario' }` */
export function parseCategoryDir(dir: string): { number: string; slug: string } | null {
  const match = /^(\d{2})-(.+)$/.exec(dir);
  if (!match) return null;
  return { number: match[1], slug: slugify(match[2]) };
}

const META_ROUTES: Record<string, string> = {
  '00-meta/CONVENCOES.md': '/convencoes',
  '00-meta/INDICE-CANONICO.md': '/compendio',
  '00-meta/REGISTRO-DE-ALTERACOES.md': '/alteracoes',
  'README.md': '/',
};

/** Caminho no repo → rota no site. `null` quando o arquivo não vira página. */
export function hrefForPath(filePath: string): string | null {
  const clean = filePath.replace(/^\.\//, '').replace(/^\//, '');
  if (clean in META_ROUTES) return META_ROUTES[clean];

  const segments = clean.split('/');
  if (segments.length !== 2) return null;

  const category = parseCategoryDir(segments[0]);
  if (!category) return null;

  const file = segments[1];
  if (!file.endsWith('.md')) return null;
  if (file === 'README.md') return `/c/${category.slug}`;

  return `/c/${category.slug}/${slugify(file.replace(/\.md$/, ''))}`;
}

/** Reconhece uma referência a documento do acervo escrita como texto. */
export function looksLikeDocPath(value: string): boolean {
  return /^(?:\d{2}-[a-z-]+\/[\w.-]+\.md|00-meta\/[\w.-]+\.md|README\.md|CLAUDE\.md)$/i.test(
    value.trim(),
  );
}
