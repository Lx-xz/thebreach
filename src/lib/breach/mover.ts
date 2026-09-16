/**
 * Mudar um documento de caminho, sem quebrar a teia.
 *
 * Renomear `grifos/grifo-da-mata/` para `grifos/grifo-umbral/` não é mexer num
 * arquivo: é mexer em todos os que citam aquele caminho — e, se o documento
 * muda de profundidade, em todas as referências que ele próprio escreve, que
 * são relativas ao lugar onde ele estava.
 *
 * Nada aqui fala com o GitHub. Este módulo **planeja**: diz que arquivos se
 * movem, que citações mudam e como fica cada documento reescrito. Quem grava é
 * o `commitarArvore`, e grava tudo num commit só — o acervo nunca fica pela
 * metade.
 *
 * Quem cita quem sai da `referencias()` de `conferir.ts`, o mesmo reconhecedor
 * que confere o acervo. Usar outro seria admitir que a conferência enxerga uma
 * coisa e a mudança enxerga outra.
 */

import { FORA_DA_TEIA, referencias } from './conferir';
import { pastaDe } from './imagens';
import { relativizar } from './slug';

export interface ArquivoMovido {
  de: string;
  para: string;
}

export interface Citacao {
  /** O documento que cita. */
  documento: string;
  escrita: string;
  nova: string;
}

export interface Plano {
  arquivos: ArquivoMovido[];
  citacoes: Citacao[];
  /** Documento → texto já com as citações trocadas. */
  reescritos: Map<string, string>;
  /** Título derivado do nome da pasta nova, para o Criador confirmar. */
  tituloProposto: string | null;
  /** Por que o plano não pode ser executado. `null` quando pode. */
  erro: string | null;
}

/**
 * Palavras que o português não capitaliza no meio de um nome. É o que faz
 * `grifo-da-mata` virar `Grifo da Mata`, como está escrito no acervo, e não
 * `Grifo Da Mata`.
 */
const ATONAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'a', 'o', 'as', 'os']);

/** `grifo-da-mata` → `Grifo da Mata`. */
export function tituloDePasta(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((palavra, indice) =>
      indice > 0 && ATONAS.has(palavra) ? palavra : palavra.charAt(0).toUpperCase() + palavra.slice(1),
    )
    .join(' ');
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Troca uma referência no texto, **pela forma em que ela é escrita** e fora dos
 * blocos cercados.
 *
 * Trocar a cadeia solta pegaria `grifo-da-mata/` dentro de
 * `grifo-da-mata-velho/`, e pegaria também os exemplos dentro de um bloco de
 * código, que são modelo e não referência. Por isso a troca só acontece nas
 * duas formas que a referência tem — `](caminho)` e `` `caminho` `` — e só nas
 * linhas que estão fora de cerca.
 */
export function trocarReferencia(
  texto: string,
  forma: 'link' | 'crase',
  escrita: string,
  nova: string,
): string {
  const padrao =
    forma === 'crase'
      ? new RegExp('(`)' + escapar(escrita) + '(`)', 'g')
      : new RegExp('(\\]\\(\\s*<?)' + escapar(escrita) + '(>?[\\s)])', 'g');

  const saida: string[] = [];
  let fechamento: string | null = null;

  for (const linha of texto.split('\n')) {
    const cerca = /^ {0,3}(`{3,}|~{3,})/.exec(linha);
    if (fechamento === null) {
      if (cerca) {
        fechamento = cerca[1][0].repeat(3);
        saida.push(linha);
        continue;
      }
      saida.push(linha.replace(padrao, `$1${nova}$2`));
    } else {
      saida.push(linha);
      if (linha.trim().startsWith(fechamento)) fechamento = null;
    }
  }
  return saida.join('\n');
}

/** Os arquivos que saem do lugar quando `de` vira `para`. */
function arquivosQueSeMovem(de: string, para: string, acervo: Iterable<string>): ArquivoMovido[] {
  // Documento solto: só ele se move.
  if (!/(^|\/)README\.md$/i.test(de)) return [{ de, para }];

  // Entidade: a pasta inteira vai junto — o README, as imagens ao lado e as
  // entidades contidas nela. O §8 diz isso com todas as letras: "mover a
  // entidade move as imagens junto".
  const pastaVelha = pastaDe(de);
  const pastaNova = pastaDe(para);
  const prefixo = pastaVelha ? `${pastaVelha}/` : '';

  const movidos: ArquivoMovido[] = [];
  for (const caminho of acervo) {
    if (!caminho.startsWith(prefixo)) continue;
    movidos.push({ de: caminho, para: `${pastaNova}/${caminho.slice(prefixo.length)}` });
  }
  return movidos;
}

/**
 * Como a referência passa a ser escrita, depois da mudança.
 *
 * A forma manda: link de cabeçalho é caminho relativo a quem cita (§3), menção
 * no corpo é caminho absoluto a partir da raiz (§6). E a barra final é o que
 * distingue a entidade do arquivo — ela tem de sobreviver à conta.
 */
function reescrever(
  forma: 'link' | 'crase',
  escrita: string,
  alvoNovo: string,
  pastaDeQuemCita: string,
): string {
  const [caminho, ...resto] = escrita.split('#');
  const ancora = resto.length ? `#${resto.join('#')}` : '';
  const denotaPasta = caminho.endsWith('/');
  const destino = denotaPasta ? pastaDe(alvoNovo) : alvoNovo;

  const base = forma === 'crase' ? destino : relativizar(pastaDeQuemCita, destino);
  return `${base}${denotaPasta ? '/' : ''}${ancora}`;
}

/**
 * O plano completo da mudança: o que se move, quem precisa ser reescrito e como.
 *
 * `acervo` é caminho → sha de tudo que existe; `textos` é o markdown de cada
 * `.md`. Não há chamada de rede aqui — dá para provar o plano inteiro contra uma
 * cópia do acervo antes de qualquer coisa tocar o GitHub.
 */
export function planejarMudanca(
  de: string,
  para: string,
  acervo: Map<string, string>,
  textos: Map<string, string>,
): Plano {
  const vazio: Plano = {
    arquivos: [],
    citacoes: [],
    reescritos: new Map(),
    tituloProposto: null,
    erro: null,
  };

  if (!acervo.has(de)) return { ...vazio, erro: `${de} não existe no acervo.` };
  if (de === para) return { ...vazio, erro: 'O caminho novo é igual ao antigo.' };
  if (acervo.has(para)) return { ...vazio, erro: `${para} já existe no acervo.` };

  const arquivos = arquivosQueSeMovem(de, para, acervo.keys());
  const jaOcupado = arquivos.find((arquivo) => acervo.has(arquivo.para));
  if (jaOcupado) return { ...vazio, erro: `${jaOcupado.para} já existe no acervo.` };

  const mapa = new Map(arquivos.map((arquivo) => [arquivo.de, arquivo.para]));

  const citacoes: Citacao[] = [];
  const reescritos = new Map<string, string>();

  for (const [documento, texto] of textos) {
    // O registro de alterações é histórico datado: cada entrada nomeia o acervo
    // do dia em que foi escrita. Um documento que depois mudou de lugar não
    // torna falsa a entrada que contou onde ele estava — reescrevê-la para o
    // conferidor ficar quieto seria reescrever o passado. É a mesma razão pela
    // qual o conferidor não o confere.
    if (FORA_DA_TEIA.has(documento)) continue;

    const refs = referencias(documento, texto);
    const seMoveu = mapa.has(documento);
    // Documento que não se move e não cita nada que se move não é tocado. A
    // mudança tem de ter o tamanho da mudança.
    if (!seMoveu && !refs.some((ref) => mapa.has(ref.alvo))) continue;

    const pastaDeQuemCita = pastaDe(mapa.get(documento) ?? documento);
    let saida = texto;

    for (const ref of refs) {
      const alvoNovo = mapa.get(ref.alvo) ?? ref.alvo;
      const nova = reescrever(ref.forma, ref.escrita, alvoNovo, pastaDeQuemCita);
      if (nova === ref.escrita) continue;
      saida = trocarReferencia(saida, ref.forma, ref.escrita, nova);
      citacoes.push({ documento: mapa.get(documento) ?? documento, escrita: ref.escrita, nova });
    }

    if (saida !== texto) reescritos.set(mapa.get(documento) ?? documento, saida);
  }

  // O §6 diz que o nome da pasta carrega o nome comum da entidade: mudou a
  // pasta, o título devia acompanhar. Proposto, nunca imposto.
  const ehEntidade = /(^|\/)README\.md$/i.test(de);
  const pastaNova = pastaDe(para).split('/').pop() ?? '';
  const tituloProposto = ehEntidade && pastaNova ? tituloDePasta(pastaNova) : null;

  return { arquivos, citacoes, reescritos, tituloProposto, erro: null };
}
