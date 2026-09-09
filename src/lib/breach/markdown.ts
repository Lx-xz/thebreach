/**
 * Pipeline markdown → HTML.
 *
 * Além da conversão padrão (com tabelas GFM, que o acervo usa bastante),
 * três transformações próprias fazem o acervo virar site:
 *  - marcadores `[CANÔNICO]` viram selos com a fonte interna destacada;
 *  - referências a arquivos `.md` viram links para as rotas do site;
 *  - tabelas ganham um contêiner com rolagem própria.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString as hastToString } from 'hast-util-to-string';
import type { Element, Root, RootContent } from 'hast';

import { MARKERS, parseMarkerToken } from './markers';
import { hrefForPath, looksLikeDocPath, withBase } from './slug';

function textNode(value: string): RootContent {
  return { type: 'text', value } as RootContent;
}

function element(tagName: string, properties: Element['properties'], children: RootContent[]): Element {
  return { type: 'element', tagName, properties, children } as Element;
}

/** `<code>[CRENÇA — Ordem X]</code>` → selo com rótulo e fonte. */
function rehypeMarkers() {
  return (tree: Root): void => {
    visit(tree, 'element', (node: Element, indexInParent, parent) => {
      if (node.tagName !== 'code' || !parent || indexInParent === undefined) return;
      const raw = hastToString(node).trim();
      if (!raw.startsWith('[')) return;
      const parsed = parseMarkerToken(raw);
      if (!parsed) return;

      const children: RootContent[] = [
        element('span', { className: ['marker__label'] }, [textNode(parsed.label)]),
      ];
      if (parsed.source) {
        children.push(element('span', { className: ['marker__source'] }, [textNode(parsed.source)]));
      }

      const badge = element(
        'span',
        {
          className: ['marker', `marker--${parsed.id.toLowerCase()}`],
          'data-marker': parsed.id,
          title: MARKERS[parsed.id].meaning,
        },
        children,
      );
      (parent as Element).children[indexInParent] = badge;
    });
  };
}

/**
 * Referências entre documentos.
 * `<code>04-bestiario/dragoes.md</code>` vira link, e links markdown para
 * arquivos `.md` passam a apontar para a rota equivalente do site.
 */
function rehypeDocLinks() {
  return (tree: Root): void => {
    visit(tree, 'element', (node: Element, indexInParent, parent) => {
      if (node.tagName === 'a') {
        const href = typeof node.properties?.href === 'string' ? node.properties.href : null;
        if (!href) return;
        if (/^https?:/i.test(href)) {
          node.properties.target = '_blank';
          node.properties.rel = ['noreferrer', 'noopener'];
          node.properties.className = ['link-external'];
          return;
        }
        if (href.startsWith('#')) return;
        const [filePath, hash = ''] = href.split('#');
        const route = hrefForPath(filePath);
        if (route) {
          node.properties.href = withBase(route) + (hash ? `#${hash}` : '');
          node.properties.className = ['link-internal'];
        }
        return;
      }

      if (node.tagName !== 'code' || !parent || indexInParent === undefined) return;
      // Já dentro de um link: não aninhar.
      if ((parent as Element).tagName === 'a') return;
      const raw = hastToString(node).trim();
      if (!looksLikeDocPath(raw)) return;
      const route = hrefForPath(raw);
      if (!route) return;

      (parent as Element).children[indexInParent] = element(
        'a',
        { href: withBase(route), className: ['doc-ref'] },
        [element('code', {}, [textNode(raw)])],
      );
    });
  };
}

/** Tabelas do acervo são largas; cada uma rola dentro do próprio contêiner. */
function rehypeTableWrapper() {
  return (tree: Root): void => {
    visit(tree, 'element', (node: Element, indexInParent, parent) => {
      if (node.tagName !== 'table' || !parent || indexInParent === undefined) return;
      if ((parent as Element).tagName === 'div') return;
      (parent as Element).children[indexInParent] = element(
        'div',
        { className: ['md-table'] },
        [node as RootContent],
      );
    });
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, {
    behavior: 'wrap',
    properties: { className: ['heading-anchor'] },
  })
  .use(rehypeMarkers)
  .use(rehypeDocLinks)
  .use(rehypeTableWrapper)
  .use(rehypeStringify, { allowDangerousHtml: false });

export async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown.trim()) return '';
  const file = await processor.process(markdown);
  return String(file);
}

/** Texto puro de um trecho de markdown, para excerto e índice de busca. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`\[[^\]`]*\]`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, (row) => row.replace(/\|/g, ' '))
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*-{3,}\s*$/gm, ' ')
    .replace(/[*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
