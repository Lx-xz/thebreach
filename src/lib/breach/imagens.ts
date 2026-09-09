/**
 * Ilustrações do acervo.
 *
 * As imagens moram no repositório `breach`, sob `imagens/`, espelhando o
 * caminho do documento que ilustram:
 *
 *     README.md                        → imagens/README.png
 *     04-bestiario/dragao-barbado.md   → imagens/04-bestiario/dragao-barbado.png
 *     04-bestiario/README.md           → imagens/04-bestiario/README.png
 *
 * Como o acervo é privado, elas não podem ser servidas direto do GitHub. O
 * script `scripts/baixar-imagens.mjs` copia tudo o que estiver sob `imagens/`
 * para `public/acervo/` antes do build, e é de lá que o site as serve.
 */

import { withBase } from './slug';

export const PASTA_IMAGENS = 'imagens';

/** Extensões aceitas, em ordem de preferência. */
const EXTENSOES = ['png', 'webp', 'jpg', 'jpeg', 'avif', 'svg'] as const;

export function ehImagem(caminho: string): boolean {
  const ext = caminho.split('.').pop()?.toLowerCase();
  return Boolean(ext && (EXTENSOES as readonly string[]).includes(ext));
}

/** Caminho no acervo → URL servida pelo site. */
export function urlDaImagem(caminhoNoAcervo: string): string {
  return withBase(`/acervo/${caminhoNoAcervo}`).replace(/\/$/, '');
}

/**
 * Procura a ilustração de um documento entre os arquivos do acervo.
 * Retorna a URL pública, ou `null` quando o documento não tem imagem.
 */
export function ilustracaoDe(caminhoDoDocumento: string, arquivos: Set<string>): string | null {
  const semExtensao = caminhoDoDocumento.replace(/\.md$/i, '');
  for (const ext of EXTENSOES) {
    const candidato = `${PASTA_IMAGENS}/${semExtensao}.${ext}`;
    if (arquivos.has(candidato)) return urlDaImagem(candidato);
  }
  return null;
}
