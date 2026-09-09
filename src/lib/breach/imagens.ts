/**
 * Ilustrações do acervo.
 *
 * Regra do acervo (CONVENCOES.md §8): as imagens de uma entidade moram na pasta
 * dela, ao lado do `README.md`. Não há árvore de imagens separada.
 *
 *     README.md                                  → hero.png
 *     04-bestiario/README.md                     → 04-bestiario/hero.png
 *     04-bestiario/dragoes/dragao-barbado/       → …/dragao-barbado/hero.png
 *                                                  …/dragao-barbado/fisionomia.png
 *
 * `hero.png` é nome reservado: é a ilustração de abertura. As demais só entram
 * se o texto as citar, por caminho relativo.
 *
 * Como o acervo é privado, as imagens não podem ser servidas direto do GitHub.
 * O script `scripts/baixar-imagens.mjs` copia todas elas para `public/acervo/`,
 * preservando o caminho, e é de lá que o site as serve.
 */

import { withBase } from './slug';

/** Nome reservado da ilustração de abertura de uma entidade. */
export const NOME_HERO = 'hero';

/** Extensões aceitas, em ordem de preferência. */
const EXTENSOES = ['png', 'webp', 'jpg', 'jpeg', 'avif', 'svg'] as const;

export function ehImagem(caminho: string): boolean {
  const ext = caminho.split('.').pop()?.toLowerCase();
  return Boolean(ext && (EXTENSOES as readonly string[]).includes(ext));
}

/** Pasta de um caminho do acervo. `''` para arquivos da raiz. */
export function pastaDe(caminho: string): string {
  const corte = caminho.lastIndexOf('/');
  return corte === -1 ? '' : caminho.slice(0, corte);
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

/** Caminho no acervo → URL servida pelo site. */
export function urlDaImagem(caminhoNoAcervo: string): string {
  return withBase(`/acervo/${caminhoNoAcervo}`).replace(/\/$/, '');
}

/**
 * Procura a ilustração de abertura de um documento entre os arquivos do acervo.
 * Retorna a URL pública, ou `null` quando a entidade não tem `hero`.
 */
export function ilustracaoDe(caminhoDoDocumento: string, arquivos: Set<string>): string | null {
  const pasta = pastaDe(caminhoDoDocumento);
  const prefixo = pasta ? `${pasta}/` : '';
  for (const ext of EXTENSOES) {
    const candidato = `${prefixo}${NOME_HERO}.${ext}`;
    if (arquivos.has(candidato)) return urlDaImagem(candidato);
  }
  return null;
}
