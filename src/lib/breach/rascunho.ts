/**
 * O texto ainda não gravado, guardado no navegador.
 *
 * A edição acontece muito no telefone, onde qualquer interrupção — uma ligação,
 * a troca de aba, a memória apertada — mata a página sem aviso. O rascunho é a
 * rede embaixo disso: nada do que foi digitado depende da aba continuar viva.
 */

import { STORAGE_KEYS } from '@/lib/layouts';

export interface Rascunho {
  /** O `sha` do arquivo quando o rascunho começou, para notar se mudou lá. */
  sha: string;
  conteudo: string;
  mensagem: string;
  /** Quando foi guardado, em milissegundos. */
  em: number;
}

function chave(path: string): string {
  return `${STORAGE_KEYS.rascunho}:${path}`;
}

export function lerRascunho(path: string): Rascunho | null {
  try {
    const bruto = window.localStorage.getItem(chave(path));
    if (!bruto) return null;
    const valor = JSON.parse(bruto) as Partial<Rascunho>;
    if (typeof valor.conteudo !== 'string' || typeof valor.sha !== 'string') return null;
    return {
      sha: valor.sha,
      conteudo: valor.conteudo,
      mensagem: typeof valor.mensagem === 'string' ? valor.mensagem : '',
      em: typeof valor.em === 'number' ? valor.em : 0,
    };
  } catch {
    // Navegação privada, cota estourada ou um resto de formato antigo: sem
    // rascunho é pior do que com, mas é melhor do que a página não abrir.
    return null;
  }
}

export function gravarRascunho(path: string, rascunho: Rascunho): void {
  try {
    window.localStorage.setItem(chave(path), JSON.stringify(rascunho));
  } catch {
    /* navegação privada ou cota cheia: o rascunho vale só enquanto a aba viver */
  }
}

export function apagarRascunho(path: string): void {
  try {
    window.localStorage.removeItem(chave(path));
  } catch {
    /* nada guardado, nada a apagar */
  }
}

/** `14 de setembro, 18:50` — a data como o rascunho é anunciado na tela. */
export function quandoFoi(em: number): string {
  if (!em) return 'há pouco';
  return new Date(em).toLocaleString('pt-BR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
