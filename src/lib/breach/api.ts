/**
 * API do acervo.
 *
 * Ponto único de consulta usado pelas páginas. Monta o compêndio inteiro uma
 * vez por processo de build e serve recortes dele — categorias, documentos,
 * índice canônico, registro de alterações e índice de busca.
 */

import type {
  BreachCategory,
  BreachDoc,
  ChangelogEntry,
  Compendium,
  IndexEntry,
  SearchRecord,
} from './types';
import {
  githubUrlFor,
  listMarkdownFiles,
  listRepoFiles,
  readMarkdown,
  REPO_URL,
  SOURCE,
  sourceDescription,
} from './source';
import { ilustracaoDe } from './imagens';
import { labelFromPath, listItemsUnder, parseDocument, tableRows } from './parse';
import { renderMarkdown, toPlainText } from './markdown';
import { mergeTallies, tallyTotal } from './markers';
import { hrefForPath, parseCategoryDir, slugify } from './slug';

/** Arquivos que não viram página. O README da raiz vira a página inicial. */
const EXCLUDED = new Set(['CLAUDE.md']);
const META_DIR = '00-meta';

function isEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => !cell || /^\*?\(?(vazio|nenhum[ao]?)\)?\*?$/i.test(cell.replace(/\*/g, '')));
}

function stripCode(value: string): string {
  return value.replace(/`/g, '').trim();
}

/** Divide um markdown em blocos por título `##`. */
function sectionBlocks(markdown: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const lines = markdown.split('\n');
  let title: string | null = null;
  let body: string[] = [];
  const flush = (): void => {
    if (title !== null) blocks.set(title, body.join('\n'));
  };
  for (const line of lines) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      title = heading[1].trim();
      body = [];
      continue;
    }
    if (title !== null) body.push(line);
  }
  flush();
  return blocks;
}

function parseCanonicalIndex(markdown: string): {
  entries: IndexEntry[];
  priorityGaps: Compendium['priorityGaps'];
  contradictions: Compendium['contradictions'];
} {
  const blocks = sectionBlocks(markdown);
  const entries: IndexEntry[] = [];
  const priorityGaps: Compendium['priorityGaps'] = [];
  const contradictions: Compendium['contradictions'] = [];

  for (const [title, body] of blocks) {
    const rows = tableRows(body);
    if (rows.length < 2) continue;
    const data = rows.slice(1).filter((cells) => !isEmptyRow(cells));

    if (/contradi/i.test(title)) {
      for (const cells of data) {
        contradictions.push({
          n: cells[0] ?? '',
          descricao: cells[1] ?? '',
          documentos: cells[2] ?? '',
          status: cells[3] ?? '',
        });
      }
      continue;
    }
    if (/lacunas/i.test(title)) {
      for (const cells of data) {
        priorityGaps.push({
          lacuna: stripCode(cells[0] ?? ''),
          onde: stripCode(cells[1] ?? ''),
          impacto: cells[2] ?? '',
        });
      }
      continue;
    }

    for (const cells of data) {
      const path = stripCode(cells[2] ?? '') || null;
      entries.push({
        categoria: title,
        entidade: stripCode(cells[0] ?? ''),
        status: cells[1] ?? '',
        path,
        href: path ? hrefForPath(path) : null,
        fato: cells[3] ?? '',
      });
    }
  }

  return { entries, priorityGaps, contradictions };
}

async function parseChangelog(markdown: string): Promise<ChangelogEntry[]> {
  const blocks = sectionBlocks(markdown);
  const entries: ChangelogEntry[] = [];
  for (const [title, body] of blocks) {
    const match = /^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.*)$/.exec(title);
    if (!match) continue; // ignora a seção "Formato de entrada"
    const clean = body.replace(/^\s*-{3,}\s*$/gm, '').trim();
    entries.push({
      date: match[1],
      title: match[2].trim(),
      html: await renderMarkdown(clean),
      plain: toPlainText(clean),
    });
  }
  return entries;
}

async function build(): Promise<Compendium> {
  const todos = await listRepoFiles();
  const acervo = new Set(todos);
  const files = (await listMarkdownFiles()).filter((file) => !EXCLUDED.has(file));
  const raws = new Map<string, string>();
  await Promise.all(
    files.map(async (file) => {
      raws.set(file, await readMarkdown(file));
    }),
  );

  const docs = await Promise.all(
    files.map((file) => parseDocument(file, raws.get(file) as string)),
  );
  for (const doc of docs) {
    doc.hero = ilustracaoDe(doc.path, acervo);
  }

  const byPath = new Map(docs.map((doc) => [doc.path, doc]));

  // Segunda passagem: agora que todos os títulos são conhecidos, os links
  // entre documentos deixam de usar o nome de arquivo como rótulo.
  for (const doc of docs) {
    for (const ref of [...doc.header.documentosRelacionados, ...doc.header.documentosDerivados]) {
      ref.label = byPath.get(ref.path)?.title ?? labelFromPath(ref.path);
    }
  }

  const dirs = [...new Set(files.map((file) => file.split('/')[0]))]
    .filter((dir) => parseCategoryDir(dir) && dir !== META_DIR)
    .sort();

  const categories: BreachCategory[] = dirs.map((dir) => {
    const parsed = parseCategoryDir(dir) as { number: string; slug: string };
    const readmePath = `${dir}/README.md`;
    const readme = byPath.get(readmePath);
    const readmeRaw = raws.get(readmePath) ?? '';
    const entries = docs
      .filter((doc) => doc.path.startsWith(`${dir}/`) && doc.kind !== 'indice-categoria')
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

    return {
      number: parsed.number,
      dir,
      slug: parsed.slug,
      title: readme?.title ?? labelFromPath(readmePath),
      description: readme ? toPlainText(readme.excerpt) : '',
      status: readme?.header.status ?? (entries.length ? 'em construção' : 'vazio'),
      docs: entries,
      gaps: listItemsUnder(readmeRaw, /lacunas/i),
      githubUrl: `${REPO_URL}/tree/${SOURCE.ref}/${dir}`,
      updatedAt: readme?.updatedAt ?? null,
      hero: readme?.hero ?? null,
    };
  });

  const indexRaw = raws.get(`${META_DIR}/INDICE-CANONICO.md`) ?? '';
  const changelogRaw = raws.get(`${META_DIR}/REGISTRO-DE-ALTERACOES.md`) ?? '';
  const { entries, priorityGaps, contradictions } = parseCanonicalIndex(indexRaw);

  const entryDocs = docs.filter((doc) => doc.kind === 'entrada' || doc.kind === 'narrativa');
  const dates = docs.map((doc) => doc.updatedAt).filter((date): date is string => Boolean(date));

  return {
    categories,
    docs,
    index: entries,
    changelog: await parseChangelog(changelogRaw),
    conventions: byPath.get(`${META_DIR}/CONVENCOES.md`) ?? null,
    indexDoc: byPath.get(`${META_DIR}/INDICE-CANONICO.md`) ?? null,
    readme: byPath.get('README.md') ?? null,
    priorityGaps,
    contradictions,
    stats: {
      docs: entryDocs.length,
      categories: categories.length,
      narratives: docs.filter((doc) => doc.kind === 'narrativa').length,
      markers: mergeTallies(entryDocs.map((doc) => doc.markers)),
      gaps: entryDocs.reduce((sum, doc) => sum + doc.gapCount, 0),
      updatedAt: dates.sort().pop() ?? null,
    },
    source: {
      owner: SOURCE.owner,
      repo: SOURCE.repo,
      ref: SOURCE.ref,
      url: REPO_URL,
      fetchedAt: new Date().toISOString(),
    },
  };
}

let pending: Promise<Compendium> | null = null;

export function getCompendium(): Promise<Compendium> {
  pending ??= build();
  return pending;
}

export async function getCategories(): Promise<BreachCategory[]> {
  return (await getCompendium()).categories;
}

export async function getCategory(slug: string): Promise<BreachCategory | null> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getDoc(categorySlug: string, docSlug: string): Promise<BreachDoc | null> {
  const compendium = await getCompendium();
  return (
    compendium.docs.find(
      (doc) => doc.categorySlug === categorySlug && doc.slug === docSlug && doc.kind !== 'indice-categoria',
    ) ?? null
  );
}

/** Documentos que citam um dado documento — retrolinks. */
export async function getBacklinks(path: string): Promise<BreachDoc[]> {
  const compendium = await getCompendium();
  return compendium.docs.filter(
    (doc) =>
      doc.path !== path &&
      doc.kind !== 'indice-categoria' &&
      [...doc.header.documentosRelacionados, ...doc.header.documentosDerivados].some(
        (ref) => ref.path === path,
      ),
  );
}

export async function getSearchIndex(): Promise<SearchRecord[]> {
  const compendium = await getCompendium();
  const records: SearchRecord[] = [];

  for (const category of compendium.categories) {
    records.push({
      title: category.title,
      href: `/c/${category.slug}`,
      categoria: 'Categoria',
      subtipo: null,
      excerpt: category.description,
      headings: category.docs.map((doc) => doc.title).join(' · '),
      body: category.gaps.join(' '),
    });
    for (const doc of category.docs) {
      records.push({
        title: doc.title,
        href: `/c/${category.slug}/${doc.slug}`,
        categoria: category.title,
        subtipo: doc.header.subtipo,
        excerpt: doc.excerpt,
        headings: doc.sections.map((section) => section.title).join(' · '),
        body: doc.plain.slice(0, 4000),
      });
    }
  }

  for (const doc of compendium.docs.filter((d) => d.kind === 'meta')) {
    const href = hrefForPath(doc.path);
    if (!href) continue;
    records.push({
      title: doc.title,
      href,
      categoria: 'Meta',
      subtipo: null,
      excerpt: doc.excerpt,
      headings: doc.sections.map((section) => section.title).join(' · '),
      body: doc.plain.slice(0, 4000),
    });
  }

  return records;
}

export { REPO_URL, SOURCE, sourceDescription, githubUrlFor, tallyTotal, slugify };
