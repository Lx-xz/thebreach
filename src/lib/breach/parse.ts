/**
 * Leitura estruturada de um documento do acervo.
 *
 * As convenções (CONVENCOES.md §3 e §7) são estáveis o bastante para um
 * parser próprio: título em `#`, cabeçalho de pares `**Chave:** valor`,
 * texto livre e seções numeradas em `##`/`###`.
 */

import type { BreachDoc, DocHeader, DocKind, DocRef, DocSection } from './types';
import { renderMarkdown, toPlainText } from './markdown';
import { mergeTallies, tallyMarkers } from './markers';
import { deaccent, hrefForPath, parseCategoryDir, slugify } from './slug';
import { githubUrlFor } from './source';

const EMPTY_VALUES = new Set(['—', '-', '–', '(nenhum)', '(vazio)', '(nenhuma)', 'n/a', '']);

function isEmptyValue(value: string): boolean {
  return EMPTY_VALUES.has(value.trim().toLowerCase());
}

/** Título legível a partir do nome do arquivo, usado enquanto o real não é conhecido. */
export function labelFromPath(filePath: string): string {
  const file = filePath.split('/').pop() ?? filePath;
  const stem = file.replace(/\.md$/i, '');
  if (stem.toUpperCase() === 'README') {
    const dir = filePath.split('/')[0];
    const parsed = parseCategoryDir(dir);
    return parsed ? parsed.slug : dir;
  }
  const withoutDate = stem.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const spaced = withoutDate.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function toDocRefs(value: string): DocRef[] {
  if (isEmptyValue(value)) return [];
  const paths = [...value.matchAll(/`([^`]+\.md)`/g)].map((m) => m[1].trim());
  const fallback = paths.length
    ? paths
    : value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.endsWith('.md'));
  return fallback.map((path) => ({
    path,
    href: hrefForPath(path) ?? '',
    label: labelFromPath(path),
  }));
}

function splitList(value: string): string[] {
  if (isEmptyValue(value)) return [];
  return value
    .split(/[,;]/)
    .map((part) => part.replace(/`/g, '').trim())
    .filter(Boolean);
}

function normalizeKey(key: string): string {
  return deaccent(key).toLowerCase().trim();
}

interface Preamble {
  header: DocHeader;
  introMarkdown: string;
}

function parsePreamble(lines: string[]): Preamble {
  const header: DocHeader = {
    classificacao: null,
    subtipo: null,
    status: null,
    fontesInternas: [],
    documentosRelacionados: [],
    documentosDerivados: [],
    ultimaAtualizacao: null,
    registradaEm: null,
    extras: [],
  };
  const intro: string[] = [];

  for (const line of lines) {
    const pair = /^\*\*(.+?):\*\*\s*(.*)$/.exec(line.trim());
    if (!pair) {
      if (/^-{3,}$/.test(line.trim())) continue;
      intro.push(line);
      continue;
    }
    const [, rawKey, rawValue] = pair;
    const key = normalizeKey(rawKey);
    const value = rawValue.trim();

    switch (key) {
      case 'classificacao':
        header.classificacao = isEmptyValue(value) ? null : value;
        break;
      case 'status':
        header.status = isEmptyValue(value) ? null : value.toLowerCase();
        break;
      case 'fontes internas':
        header.fontesInternas = splitList(value);
        break;
      case 'documentos relacionados':
        header.documentosRelacionados = toDocRefs(value);
        break;
      case 'documentos derivados':
        header.documentosDerivados = toDocRefs(value);
        break;
      case 'ultima atualizacao':
        header.ultimaAtualizacao = isEmptyValue(value) ? null : value;
        break;
      case 'registrada em':
      case 'registrado em':
        header.registradaEm = isEmptyValue(value) ? null : value;
        break;
      default:
        if (!isEmptyValue(value)) header.extras.push({ key: rawKey.trim(), value });
    }
  }

  if (header.classificacao) {
    const parts = header.classificacao.split('›').map((part) => part.trim());
    header.subtipo = parts.length > 1 ? parts[parts.length - 1] : null;
  }

  return { header, introMarkdown: intro.join('\n').trim() };
}

interface RawSection {
  level: 2 | 3;
  number: string | null;
  title: string;
  body: string[];
}

function splitSections(lines: string[]): RawSection[] {
  const sections: RawSection[] = [];
  let current: RawSection | null = null;

  for (const line of lines) {
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length === 2 ? 2 : 3;
      const rest = heading[2].trim();
      const numbered = /^(\d+(?:\.\d+)*)[.)]?\s+(.*)$/.exec(rest);
      current = {
        level: level as 2 | 3,
        number: numbered ? numbered[1] : null,
        title: numbered ? numbered[2].trim() : rest,
        body: [],
      };
      sections.push(current);
      continue;
    }
    if (current) current.body.push(line);
  }

  return sections;
}

async function buildSection(raw: RawSection): Promise<DocSection> {
  const markdown = raw.body.join('\n').replace(/^\s*-{3,}\s*$/gm, '').trim();
  const plain = toPlainText(markdown);
  const markers = tallyMarkers(markdown);
  const id = `s-${slugify(`${raw.number ?? ''} ${raw.title}`)}`;

  return {
    id,
    number: raw.number,
    title: raw.title,
    level: raw.level,
    html: await renderMarkdown(markdown),
    markers,
    isGap: Boolean(markers.LACUNA) && plain.length < 4,
    children: [],
  };
}

/** Aninha as `###` dentro da `##` anterior. */
function nest(sections: DocSection[]): DocSection[] {
  const top: DocSection[] = [];
  for (const section of sections) {
    if (section.level === 3 && top.length > 0) {
      top[top.length - 1].children.push(section);
    } else {
      top.push(section);
    }
  }
  return top;
}

function kindFor(filePath: string): DocKind {
  if (filePath.startsWith('00-meta/')) return 'meta';
  if (filePath.endsWith('/README.md')) return 'indice-categoria';
  if (filePath.startsWith('09-')) return 'narrativa';
  return 'entrada';
}

function buildExcerpt(introPlain: string, sections: DocSection[]): string {
  const source =
    introPlain ||
    toPlainText(
      sections
        .find((section) => !section.isGap)
        ?.html.replace(/<[^>]+>/g, ' ') ?? '',
    );
  const clean = source.replace(/\s+/g, ' ').trim();
  if (clean.length <= 190) return clean;
  const cut = clean.slice(0, 190);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return `${lastStop > 90 ? cut.slice(0, lastStop + 1) : cut.trimEnd()}…`;
}

export async function parseDocument(filePath: string, markdown: string): Promise<BreachDoc> {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  const title =
    titleIndex >= 0 ? lines[titleIndex].replace(/^#\s+/, '').trim() : labelFromPath(filePath);

  const afterTitle = lines.slice(titleIndex + 1);
  const firstSection = afterTitle.findIndex((line) => /^#{2,3}\s+/.test(line));
  const preambleLines = firstSection === -1 ? afterTitle : afterTitle.slice(0, firstSection);
  const sectionLines = firstSection === -1 ? [] : afterTitle.slice(firstSection);

  const { header, introMarkdown } = parsePreamble(preambleLines);
  const rawSections = splitSections(sectionLines);
  const sections = nest(await Promise.all(rawSections.map(buildSection)));

  const introPlain = toPlainText(introMarkdown);
  const bodyMarkdown = [introMarkdown, ...rawSections.map((s) => s.body.join('\n'))].join('\n');

  const dir = filePath.split('/')[0];
  const category = parseCategoryDir(dir);
  const fileStem = (filePath.split('/').pop() ?? '').replace(/\.md$/i, '');

  return {
    path: filePath,
    categorySlug: category?.slug ?? slugify(dir),
    slug: fileStem.toUpperCase() === 'README' ? 'index' : slugify(fileStem),
    title,
    kind: kindFor(filePath),
    header,
    introHtml: await renderMarkdown(introMarkdown),
    sections,
    markers: mergeTallies([
      tallyMarkers(introMarkdown),
      ...sections.flatMap((section) => [section.markers, ...section.children.map((c) => c.markers)]),
    ]),
    gapCount: [...sections, ...sections.flatMap((s) => s.children)].filter((s) => s.isGap).length,
    excerpt: buildExcerpt(introPlain, sections),
    plain: `${introPlain} ${toPlainText(bodyMarkdown)}`.trim(),
    githubUrl: githubUrlFor(filePath),
    updatedAt: header.ultimaAtualizacao ?? header.registradaEm,
  };
}

/** Itens de uma lista markdown sob um título de seção específico. */
export function listItemsUnder(markdown: string, headingMatcher: RegExp): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => /^#{2,3}\s+/.test(line) && headingMatcher.test(line));
  if (start === -1) return [];
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{2,3}\s+/.test(line)) break;
    const item = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (item) items.push(item[1].replace(/`/g, '').trim());
  }
  return items.filter((item) => !isEmptyValue(item));
}

/** Linhas de tabelas GFM de um documento, já divididas em células. */
export function tableRows(markdown: string, headingMatcher?: RegExp): string[][] {
  const lines = markdown.split('\n');
  let scope = lines;
  if (headingMatcher) {
    const start = lines.findIndex((line) => /^#{1,3}\s+/.test(line) && headingMatcher.test(line));
    if (start === -1) return [];
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => /^#{1,3}\s+/.test(line));
    scope = end === -1 ? rest : rest.slice(0, end);
  }
  return scope
    .filter((line) => line.trim().startsWith('|'))
    .map((line) =>
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/.test(cell)));
}
