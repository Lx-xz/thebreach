/**
 * O cabeçalho de um documento do acervo (CONVENCOES.md §3), remendado dentro do
 * markdown cru.
 *
 * Por que remendo e não geração: `parse.ts` é uma projeção **com perda** e não
 * tem serializador. Ele joga fora o markdown do corpo, desfaz a ordem dos
 * campos, minúscula o `status` e colapsa `—`/`-`/`n/a` em `null`. Regenerar o
 * arquivo a partir dos campos lidos produziria um diff enorme e errado contra o
 * acervo. Então aqui só se troca a linha pedida, e nada mais se move.
 */

import { deaccent } from './slug';

/** Os cinco campos de §3, na ordem fixa em que aparecem. */
export const CAMPOS = [
  'Classificação',
  'Status',
  'Fontes internas',
  'Documentos relacionados',
  'Última atualização',
] as const;

export type Campo = (typeof CAMPOS)[number];

/** Os três valores de `Status` previstos em §3. */
export const STATUS = ['rascunho', 'em revisão', 'estável'] as const;

/** Campo sem informação fica presente e vazio: §3 diz que ausente é esquecido. */
export const VAZIO = '—';

/** O mesmo reconhecedor de linha que `parse.ts` usa, para não divergirem. */
const PAR = /^\*\*(.+?):\*\*\s*(.*)$/;

function normalizar(chave: string): string {
  return deaccent(chave).toLowerCase().trim();
}

/**
 * Onde o cabeçalho pode estar: do começo até a primeira seção `## `.
 * Depois disso é corpo, e o corpo não se toca.
 */
function fimDoPreambulo(linhas: string[]): number {
  const secao = linhas.findIndex((linha) => /^#{2,}\s/.test(linha));
  return secao === -1 ? linhas.length : secao;
}

/** A linha de um campo dentro do preâmbulo, ou `-1`. */
function linhaDoCampo(linhas: string[], limite: number, campo: string): number {
  const alvo = normalizar(campo);
  for (let i = 0; i < limite; i += 1) {
    const par = PAR.exec(linhas[i].trim());
    if (par && normalizar(par[1]) === alvo) return i;
  }
  return -1;
}

/** Os cinco campos como estão hoje no texto. `null` quando o campo não existe. */
export function lerCampos(bruto: string): Record<Campo, string | null> {
  const linhas = bruto.split('\n');
  const limite = fimDoPreambulo(linhas);
  const saida = {} as Record<Campo, string | null>;

  for (const campo of CAMPOS) {
    const i = linhaDoCampo(linhas, limite, campo);
    saida[campo] = i === -1 ? null : (PAR.exec(linhas[i].trim())?.[2] ?? '').trim();
  }
  return saida;
}

/**
 * Onde enfiar um campo que ainda não existe.
 *
 * Logo abaixo do último campo que o precede na ordem de §3. Se nenhum deles
 * existe, depois do título e da linha da ilustração: todo documento de entidade
 * abre com `# Título` seguido de `![alt](hero.png)`, e o cabeçalho vem depois.
 */
function ondeEnfiar(linhas: string[], limite: number, campo: Campo): number {
  const posicao = CAMPOS.indexOf(campo);

  for (let anterior = posicao - 1; anterior >= 0; anterior -= 1) {
    const i = linhaDoCampo(linhas, limite, CAMPOS[anterior]);
    if (i !== -1) return i + 1;
  }

  // Nenhum campo anterior: o primeiro campo que existir marca o começo do bloco.
  for (let seguinte = posicao + 1; seguinte < CAMPOS.length; seguinte += 1) {
    const i = linhaDoCampo(linhas, limite, CAMPOS[seguinte]);
    if (i !== -1) return i;
  }

  // Documento sem cabeçalho nenhum: depois do título e da ilustração de abertura.
  let i = 0;
  if (i < limite && /^#\s/.test(linhas[i].trim())) i += 1;
  while (i < limite && /^!\[[^\]]*\]\([^)]*\)$/.test(linhas[i].trim())) i += 1;
  return i;
}

/**
 * Reescreve a linha `**Campo:** valor` do cabeçalho, sem tocar em mais nada.
 *
 * Idempotente: aplicar duas vezes com o mesmo valor não muda o texto. Nunca
 * reordena campos existentes, nem mexe nos extras (`**Registrada em:**` e
 * afins), nas réguas `---` ou no corpo.
 */
export function definirCampo(bruto: string, campo: Campo, valor: string): string {
  const linhas = bruto.split('\n');
  const limite = fimDoPreambulo(linhas);
  const texto = valor.trim() || VAZIO;
  const nova = `**${campo}:** ${texto}`;

  const existente = linhaDoCampo(linhas, limite, campo);
  if (existente !== -1) {
    if (linhas[existente] === nova) return bruto;
    linhas[existente] = nova;
    return linhas.join('\n');
  }

  // A linha em branco entre os campos não é enfeite: sem ela o Markdown junta
  // os cinco num parágrafo só e o cabeçalho deixa de ser lido como ficha
  // (CONVENCOES.md §3). Aqui ela é garantida dos dois lados, sem duplicar as
  // que já existem.
  const onde = ondeEnfiar(linhas, limite, campo);
  const enfiar: string[] = [];
  if (onde > 0 && linhas[onde - 1].trim() !== '') enfiar.push('');
  enfiar.push(nova);
  if (onde >= linhas.length || linhas[onde].trim() !== '') enfiar.push('');

  linhas.splice(onde, 0, ...enfiar);
  return linhas.join('\n');
}

/**
 * O documento sem as linhas do cabeçalho — **só para exibição**, nunca para
 * gravar.
 *
 * A página de leitura não desenha esses campos como prosa: `content.tsx` os
 * transforma numa ficha, com os documentos relacionados virando painel. Mostrar
 * as cinco linhas em negrito dentro da prévia seria mostrar uma coisa que o
 * site não mostra — e repetir o que o formulário já exibe logo acima.
 */
export function semCabecalho(bruto: string): string {
  const linhas = bruto.split('\n');
  const limite = fimDoPreambulo(linhas);
  const saida = linhas.filter((linha, i) => !(i < limite && PAR.test(linha.trim())));
  // As linhas em branco que sobraram no lugar dos campos se juntam. O Markdown
  // trata duas ou vinte da mesma forma, então isto é só asseio.
  return saida.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * A data de hoje, `AAAA-MM-DD`, pelos componentes **locais**.
 *
 * `toISOString()` daria a data em UTC: para quem escreve em UTC−3, uma edição
 * das nove da noite entraria no acervo com a data de amanhã.
 */
export function hoje(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}
