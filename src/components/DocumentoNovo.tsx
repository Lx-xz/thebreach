'use client';

import { useMemo, useState } from 'react';
import { CAMPOS, STATUS, definirCampo } from '@/lib/breach/cabecalho';
import { labelFromPath, relativizar, slugify } from '@/lib/breach/slug';
import type { Mudanca } from '@/lib/breach/github';

interface Props {
  acervo: Map<string, string> | null;
  onGravar: (mudancas: Mudanca[], mensagem: string, destino: string) => void;
}

/**
 * O modelo do §7, inteiro.
 *
 * As seções ficam todas, vazias e marcadas: "seções sem conteúdo permanecem no
 * documento, marcadas com `[LACUNA]`. Elas indicam o que falta." Um documento
 * novo nasce sabendo o que ainda não tem.
 */
const SECOES: Array<{ nivel: 2 | 3; numero: string; titulo: string }> = [
  { nivel: 2, numero: '1', titulo: 'Descrição geral' },
  { nivel: 2, numero: '2', titulo: 'Características' },
  { nivel: 2, numero: '3', titulo: 'Comportamento / funcionamento' },
  { nivel: 2, numero: '4', titulo: 'Distribuição e ocorrência' },
  { nivel: 2, numero: '5', titulo: 'Relação com os povos' },
  { nivel: 2, numero: '6', titulo: 'Registro dos habitantes' },
  { nivel: 3, numero: '6.1', titulo: 'O que se sabe' },
  { nivel: 3, numero: '6.2', titulo: 'O que se acredita erroneamente' },
  { nivel: 2, numero: '7', titulo: 'Lacunas' },
  { nivel: 2, numero: '8', titulo: 'Ocorrências nas narrativas' },
];

function modelo(titulo: string): string {
  const corpo = SECOES.map(
    ({ nivel, numero, titulo: nome }) =>
      `${'#'.repeat(nivel)} ${numero}. ${nome}\n\n\`[LACUNA]\`\n`,
  ).join('\n');
  return `# ${titulo}\n\n${corpo}`;
}

/** As pastas onde um documento novo pode nascer. */
function pastasDisponiveis(acervo: Map<string, string>): string[] {
  const pastas = new Set<string>();
  for (const caminho of acervo.keys()) {
    if (!caminho.toLowerCase().endsWith('.md')) continue;
    const partes = caminho.split('/');
    for (let i = 1; i < partes.length; i += 1) pastas.add(partes.slice(0, i).join('/'));
  }
  // Só abaixo das pastas numeradas: a regra do §6 vale ali.
  return [...pastas].filter((p) => /^\d{2}-/.test(p)).sort();
}

export function DocumentoNovo({ acervo, onGravar }: Props) {
  const [mae, setMae] = useState('');
  const [nome, setNome] = useState('');
  const [classificacao, setClassificacao] = useState('');
  const [status, setStatus] = useState<string>(STATUS[0]);
  const [relacionados, setRelacionados] = useState<string[]>([]);

  const pastas = useMemo(() => (acervo ? pastasDisponiveis(acervo) : []), [acervo]);

  const entidades = useMemo(() => {
    if (!acervo) return [];
    return [...acervo.keys()]
      .filter((c) => /(^|\/)README\.md$/i.test(c) && /^\d{2}-/.test(c))
      .sort();
  }, [acervo]);

  // §6: o nome da pasta carrega o nome comum — minúsculas, sem acentos, hífens.
  const slug = slugify(nome);
  const destino = mae && slug ? `${mae}/${slug}/README.md` : '';
  const jaExiste = Boolean(destino && acervo?.has(destino));

  const gravar = (): void => {
    if (!destino || jaExiste) return;
    let texto = modelo(nome.trim());

    // Os campos entram pela mesma cirurgia que o formulário usa, na ordem de §3.
    for (const campo of CAMPOS) {
      if (campo === 'Classificação') texto = definirCampo(texto, campo, classificacao);
      else if (campo === 'Status') texto = definirCampo(texto, campo, status);
      else if (campo === 'Documentos relacionados') {
        const pastaNova = `${mae}/${slug}`;
        const links = relacionados
          .map((alvo) => {
            const pasta = alvo.replace(/\/README\.md$/i, '');
            return `[${labelFromPath(alvo)}](${relativizar(pastaNova, pasta)}/)`;
          })
          .join(', ');
        texto = definirCampo(texto, campo, links);
      } else texto = definirCampo(texto, campo, '');
    }

    onGravar(
      [{ tipo: 'texto', path: destino, conteudo: texto }],
      `${mae.replace(/^\d{2}-/, '')}: abre o documento de ${nome.trim()}`,
      destino,
    );
  };

  if (!acervo) return <p className="editor__dica">A lista do acervo ainda não chegou.</p>;

  return (
    <div className="painel__corpo">
      <label className="editor__mensagem">
        <span className="editor__rotulo">Onde nasce</span>
        <span className="editor__campo">
          <select value={mae} onChange={(event) => setMae(event.target.value)}>
            <option value="">escolha a pasta</option>
            {pastas.map((pasta) => (
              <option key={pasta} value={pasta}>
                {pasta}
              </option>
            ))}
          </select>
        </span>
      </label>

      <label className="editor__mensagem">
        <span className="editor__rotulo">Nome comum</span>
        <span className="editor__campo">
          <input type="text" value={nome} onChange={(event) => setNome(event.target.value)} />
        </span>
      </label>

      {destino ? (
        <p className="editor__dica">
          Vai nascer em <code>{destino}</code>
          {jaExiste ? ' — e já existe alguém aí.' : '.'}
        </p>
      ) : null}

      <label className="editor__mensagem">
        <span className="editor__rotulo">Classificação</span>
        <span className="editor__campo">
          <input
            type="text"
            value={classificacao}
            onChange={(event) => setClassificacao(event.target.value)}
            placeholder="Bestiário › espécie"
          />
        </span>
      </label>

      <label className="editor__mensagem">
        <span className="editor__rotulo">Status</span>
        <span className="editor__campo">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS.map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </select>
        </span>
      </label>

      <fieldset className="documentonovo__relacionados">
        <legend className="editor__rotulo">Documentos relacionados</legend>
        <div className="documentonovo__caixa">
          {entidades.map((alvo) => (
            <label key={alvo}>
              <input
                type="checkbox"
                checked={relacionados.includes(alvo)}
                onChange={(event) =>
                  setRelacionados((atual) =>
                    event.target.checked ? [...atual, alvo] : atual.filter((a) => a !== alvo),
                  )
                }
              />
              {labelFromPath(alvo)} <code>{alvo.replace(/\/README\.md$/i, '/')}</code>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="editor__dica">
        Nasce com as oito seções do §7, cada uma marcada <code>[LACUNA]</code> — é assim que o
        documento diz o que ainda falta nele.
      </p>

      <button
        type="button"
        className="editor__botao editor__botao--forte"
        onClick={gravar}
        disabled={!destino || jaExiste}
      >
        Criar documento
      </button>
    </div>
  );
}
