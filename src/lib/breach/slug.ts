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

/**
 * Caminho de entidade → caminho do documento.
 *
 * Uma entidade é uma pasta (CONVENCOES.md §6), e é assim que o acervo se refere
 * a ela: `04-bestiario/dragoes/dragao-barbado/`. O documento dela é o README
 * dentro dessa pasta.
 */
export function normalizeDocPath(value: string): string {
  const clean = value.trim().replace(/^\.\//, '').replace(/^\//, '');
  if (/\.md$/i.test(clean)) return clean;
  return `${clean.replace(/\/$/, '')}/README.md`;
}

/** Caminho no repo → rota no site. `null` quando o arquivo não vira página. */
export function hrefForPath(filePath: string): string | null {
  const clean = normalizeDocPath(filePath);
  if (clean in META_ROUTES) return META_ROUTES[clean];

  const segments = clean.split('/');
  if (segments.length < 2) return null;

  const category = parseCategoryDir(segments[0]);
  if (!category) return null;

  const file = segments[segments.length - 1];
  if (!file.endsWith('.md')) return null;

  // Segmentos entre a categoria e o arquivo: as pastas das entidades.
  const trail = segments.slice(1, -1).map(slugify);
  if (file !== 'README.md') trail.push(slugify(file.replace(/\.md$/, '')));
  if (!trail.length) return `/c/${category.slug}`;

  return `/c/${category.slug}/${trail.join('/')}`;
}

/** Reconhece uma referência a documento ou entidade do acervo escrita como texto. */
export function looksLikeDocPath(value: string): boolean {
  const raw = value.trim();
  if (/^(README|CLAUDE)\.md$/i.test(raw)) return true;
  // Entidade: pasta numerada seguida de uma ou mais pastas, com barra final.
  if (/^\d{2}-[a-z-]+(?:\/[\w.-]+)*\/$/i.test(raw)) return true;
  // Documento solto: pasta numerada e um arquivo .md em qualquer profundidade.
  return /^\d{2}-[a-z-]+(?:\/[\w.-]+)*\/[\w.-]+\.md$/i.test(raw);
}
