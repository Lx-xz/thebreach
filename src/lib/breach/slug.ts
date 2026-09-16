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

/**
 * Esta entidade pode conter outras?
 *
 * Só quem é pasta pode receber um documento dentro — §6: entidade é pasta, e o
 * documento dela é o `README.md`. Fora isso, quem decide é o posto: a
 * **espécie** é a folha da régua `classe › ordem › família › espécie` e não
 * agrupa ninguém. Categoria, classe e família agrupam, e é dentro delas que a
 * espécie nova nasce.
 */
export function podeConterEntidades(filePath: string, subtipo: string | null): boolean {
  if (!/(^|\/)README\.md$/i.test(filePath)) return false;
  // "A regra vale abaixo das pastas numeradas" (§6): a raiz do acervo não
  // recebe entidade, e o `00-meta` não é categoria.
  if (!parseCategoryDir(filePath.split('/')[0] ?? '')) return false;
  return deaccent(subtipo ?? '').toLowerCase() !== 'especie';
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

/** Junta uma pasta do acervo com um caminho relativo, resolvendo `.` e `..`. */
export function resolverRelativo(pasta: string, relativo: string): string {
  const partes = pasta ? pasta.split('/') : [];
  for (const parte of relativo.split('/')) {
    if (!parte || parte === '.') continue;
    if (parte === '..') partes.pop();
    else partes.push(parte);
  }
  return partes.join('/');
}

/**
 * O inverso de `resolverRelativo`: dois caminhos do acervo → como o primeiro
 * escreve o segundo.
 *
 * `relativizar('04-bestiario/aves/grifos/grifo-real', '04-bestiario/aves/grifos/grifo-umbral')`
 * dá `../grifo-umbral`. É o que permite reescrever uma citação quando o alvo
 * muda de lugar, mantendo a forma relativa que o §3 exige.
 */
export function relativizar(daPasta: string, paraCaminho: string): string {
  const de = daPasta ? daPasta.split('/') : [];
  const para = paraCaminho ? paraCaminho.split('/') : [];

  let comum = 0;
  while (comum < de.length && comum < para.length && de[comum] === para[comum]) comum += 1;

  const subir = Array.from({ length: de.length - comum }, () => '..');
  const descer = para.slice(comum);
  const partes = [...subir, ...descer];
  // Mesma pasta e mesmo nome: o alvo é o próprio lugar de quem cita.
  return partes.length ? partes.join('/') : '.';
}

/** `humanize` de um nome de pasta ou arquivo: `grifo-umbral` → `Grifo umbral`. */
function humanize(stem: string): string {
  const spaced = stem.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Título legível a partir do caminho, usado enquanto o real não é conhecido.
 *
 * Mora aqui, e não em `parse.ts`, porque o editor precisa dela no navegador e
 * `parse.ts` importa `source.ts`, que lê do disco.
 */
export function labelFromPath(filePath: string): string {
  const segments = normalizeDocPath(filePath).split('/');
  const stem = (segments[segments.length - 1] ?? '').replace(/\.md$/i, '');
  if (stem.toUpperCase() !== 'README') return humanize(stem);

  // O documento de uma entidade chama-se README: o nome está na pasta
  // (CONVENCOES.md §6).
  const dir = segments[segments.length - 2] ?? '';
  if (!dir) return 'Compêndio';
  const parsed = parseCategoryDir(dir);
  return parsed ? parsed.slug : humanize(dir);
}

/**
 * Referência a documento escrita relativa a quem a cita → caminho no acervo.
 *
 * O acervo escreve estas referências por caminho relativo pelo mesmo motivo que
 * escreve as imagens assim (CONVENCOES.md §3 e §8): é o caminho relativo que
 * funciona nos dois leitores, o GitHub e este site.
 *
 * `null` quando o alvo não é documento do acervo — endereço externo, âncora,
 * imagem, qualquer coisa que não deva virar rota.
 */
export function resolverRefRelativa(pasta: string, alvo: string): string | null {
  const limpo = alvo.trim();
  if (!limpo || limpo.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(limpo)) return null;

  const semAncora = limpo.split('#')[0];
  const junto = semAncora.startsWith('/')
    ? semAncora.slice(1)
    : resolverRelativo(pasta, semAncora);

  // A barra final é o que distingue a entidade do arquivo (CONVENCOES.md §6) e
  // ela se perde na junção; o reconhecedor depende dela para aceitar a pasta.
  const caminho = /\.md$/i.test(junto) ? junto : `${junto}/`;
  return looksLikeDocPath(caminho) ? caminho : null;
}
