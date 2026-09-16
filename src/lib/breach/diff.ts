/**
 * O que muda entre o texto lido e o texto editado, linha a linha.
 *
 * O acervo é conduzido por diff — foi lendo diffs que apareceram o `.pyc`
 * intruso e o `00-meta/` quebrado dentro de uma linha de exemplo. Gravar sem
 * olhar, ainda mais do telefone, é o contrário do método.
 *
 * O algoritmo é do `jsdiff`. O que está aqui é o que ele não faz: recortar os
 * trechos iguais, para uma correção de duas linhas num documento de quatrocentas
 * aparecer como duas linhas e não como quatrocentas.
 */

import { diffLines } from 'diff';

/** Linhas iguais mantidas de cada lado de um trecho mudado. */
const CONTEXTO = 2;

export type Linha =
  | { tipo: 'mais' | 'menos' | 'igual'; texto: string }
  | { tipo: 'corte'; escondidas: number };

/** `'a\nb\n'` → `['a', 'b']`: o fim de linha final não abre uma linha vazia. */
function emLinhas(trecho: string): string[] {
  const linhas = trecho.split('\n');
  if (linhas.length > 1 && linhas[linhas.length - 1] === '') linhas.pop();
  return linhas;
}

/** Corta os trechos iguais longos, deixando `CONTEXTO` linhas de cada lado. */
function recortar(linhas: Linha[]): Linha[] {
  const saida: Linha[] = [];

  for (let i = 0; i < linhas.length; ) {
    if (linhas[i].tipo !== 'igual') {
      saida.push(linhas[i]);
      i += 1;
      continue;
    }

    let fim = i;
    while (fim < linhas.length && linhas[fim].tipo === 'igual') fim += 1;
    const corrida = linhas.slice(i, fim);

    // No começo do documento não há nada acima para dar contexto, e no fim não
    // há nada abaixo: nesses dois casos só um dos lados se mantém.
    const antes = i === 0 ? 0 : CONTEXTO;
    const depois = fim === linhas.length ? 0 : CONTEXTO;
    const escondidas = corrida.length - antes - depois;

    // Cortar uma linha só não economiza nada: a marca do corte ocupa o lugar dela.
    if (escondidas <= 1) {
      saida.push(...corrida);
    } else {
      saida.push(...corrida.slice(0, antes));
      saida.push({ tipo: 'corte', escondidas });
      if (depois) saida.push(...corrida.slice(corrida.length - depois));
    }
    i = fim;
  }

  return saida;
}

/** As linhas a mostrar. Vazio quando os dois textos são iguais. */
export function compararLinhas(antes: string, depois: string): Linha[] {
  if (antes === depois) return [];

  const linhas: Linha[] = [];
  // `ignoreNewlineAtEof`: sem isso, acrescentar uma linha no fim de um arquivo
  // que não termina em quebra faz a última linha antiga aparecer como removida
  // e reposta. Acrescentar no fim é o gesto mais comum aqui.
  for (const parte of diffLines(antes, depois, { ignoreNewlineAtEof: true })) {
    const tipo = parte.added ? 'mais' : parte.removed ? 'menos' : 'igual';
    for (const texto of emLinhas(parte.value)) linhas.push({ tipo, texto });
  }

  return recortar(linhas);
}

/** Quantas linhas entram e quantas saem, para anunciar o tamanho da mudança. */
export function contar(linhas: Linha[]): { mais: number; menos: number } {
  let mais = 0;
  let menos = 0;
  for (const linha of linhas) {
    if (linha.tipo === 'mais') mais += 1;
    if (linha.tipo === 'menos') menos += 1;
  }
  return { mais, menos };
}
