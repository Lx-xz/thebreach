/**
 * A teia de referências de um documento, conferida antes do commit.
 *
 * Porte de `scripts/conferir-referencias.py`, que roda no CI do acervo e
 * derruba a conferência quando uma referência aponta para o vazio. Aqui a
 * mesma pergunta é feita antes de gravar, e não depois em vermelho.
 *
 * As regras têm de bater com as do Python, senão os dois discordam sobre o que
 * é referência — por isso o que dá para reusar de `slug.ts` e `imagens.ts` é
 * reusado, e não reescrito: os dois reconhecedores de caminho do Python são
 * literalmente os dois de `looksLikeDocPath`.
 *
 * O que **não** está aqui: os órfãos. Saber que ninguém cita um documento exige
 * ler o acervo inteiro, e isso continua sendo assunto do CI.
 */

import { ehImagem, pastaDe } from './imagens';
import { looksLikeDocPath, resolverRelativo } from './slug';

export interface Achado {
  /** O caminho como foi escrito no documento. */
  escrita: string;
  /** O arquivo que precisaria existir. */
  alvo: string;
}

// Bloco cercado é exemplo e modelo: o que está dentro dele não é referência.
const CERCA = /^ {0,3}(`{3,}|~{3,})/;
const LINK = /(!?)\[[^\]]*\]\(\s*<?([^)>\s]+)>?[^)]*\)/g;
const CRASE = /`([^`\n]+)`/g;
const ESQUEMA = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Numa narrativa só o cabeçalho é do acervo. O corpo é o texto do Criador,
 * arquivado sem edição, e ele nomeia de propósito o que ainda não existe — é
 * dele que os documentos nascem. Cobrar referência resolvida do corpo de uma
 * narrativa é cobrar que o futuro já esteja escrito.
 */
const NARRATIVAS = '09-narrativas/';

/**
 * O registro de alterações é histórico editorial: uma entrada é datada e fica
 * como foi escrita, nomeando o acervo do dia em que foi registrada. Reescrever
 * o passado para o conferidor ficar quieto seria reescrever o histórico.
 */
const FORA_DA_TEIA = new Set(['00-meta/REGISTRO-DE-ALTERACOES.md']);

/** O mesmo texto, com os blocos cercados trocados por linhas vazias. */
function semCodigo(texto: string): string {
  const fora: string[] = [];
  let fechamento: string | null = null;

  for (const linha of texto.split('\n')) {
    if (fechamento === null) {
      const marca = CERCA.exec(linha);
      if (marca) {
        fechamento = marca[1][0].repeat(3);
        fora.push('');
        continue;
      }
      fora.push(linha);
    } else {
      fora.push('');
      if (linha.trim().startsWith(fechamento)) fechamento = null;
    }
  }
  return fora.join('\n');
}

/**
 * Caminho citado → arquivo que precisa existir.
 *
 * Uma entidade é uma pasta e o documento dela é o README dentro dela
 * (CONVENCOES.md §6): é a barra final que distingue a entidade do arquivo.
 */
function alvoDeEntidade(caminho: string): string {
  if (ehImagem(caminho)) return caminho;
  if (/\.md$/i.test(caminho)) return caminho;
  return `${caminho.replace(/\/$/, '')}/README.md`;
}

/** As referências escritas num documento, já resolvidas em caminhos do acervo. */
function referencias(path: string, texto: string): Achado[] {
  const pasta = pastaDe(path);
  let fonte = texto;

  if (path.startsWith(NARRATIVAS)) {
    const corte = fonte.indexOf('\n## ');
    if (corte !== -1) fonte = fonte.slice(0, corte);
  }

  const corpo = semCodigo(fonte);
  const achadas: Achado[] = [];

  for (const [, , destino] of corpo.matchAll(LINK)) {
    if (ESQUEMA.test(destino) || destino.startsWith('#')) continue;
    const limpo = destino.split('#')[0].trim();
    if (!limpo) continue;
    const junto = limpo.startsWith('/') ? limpo.slice(1) : resolverRelativo(pasta, limpo);
    // A junção come a barra final, e é ela que diz "isto é uma entidade".
    achadas.push({ escrita: destino, alvo: alvoDeEntidade(limpo.endsWith('/') ? `${junto}/` : junto) });
  }

  for (const [, trecho] of corpo.matchAll(CRASE)) {
    const bruto = trecho.trim();
    // Menção entre crases: o caminho é a partir da raiz do acervo (§6).
    //
    // `looksLikeDocPath` reconhece ainda `README.md` e `CLAUDE.md` soltos, que
    // os dois regexes do Python não pegam. É de propósito: este é o mesmo
    // reconhecedor que o site usa para transformar a menção em link, e o que
    // vira link é o que a conferência precisa cobrar. Como os dois arquivos
    // existem, isso nunca produz um achado — a não ser que deixem de existir,
    // que é justamente o caso em que se quer saber.
    if (looksLikeDocPath(bruto)) achadas.push({ escrita: bruto, alvo: alvoDeEntidade(bruto) });
  }

  return achadas;
}

/**
 * As referências deste documento que apontam para o vazio.
 *
 * `arquivos` é a lista de tudo que existe no acervo. Documento fora da teia não
 * é conferido.
 */
export function conferirTexto(path: string, texto: string, arquivos: Set<string>): Achado[] {
  if (FORA_DA_TEIA.has(path)) return [];

  const vistos = new Set<string>();
  return referencias(path, texto).filter((achado) => {
    if (arquivos.has(achado.alvo) || vistos.has(achado.alvo)) return false;
    vistos.add(achado.alvo);
    return true;
  });
}
