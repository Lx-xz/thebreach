'use client';

import { useMemo, useState } from 'react';
import { definirTitulo } from '@/lib/breach/cabecalho';
import { planejarMudanca, type Plano } from '@/lib/breach/mover';
import type { Mudanca } from '@/lib/breach/github';

interface Props {
  path: string;
  /** Caminho → sha de tudo que existe no acervo. */
  acervo: Map<string, string> | null;
  /** O markdown de cada `.md`, carregado sob demanda. */
  textos: Map<string, string> | null;
  carregando: boolean;
  onCarregar: () => void;
  onGravar: (mudancas: Mudanca[], mensagem: string, destino: string) => void;
  /** Caminho novo sugerido de fora — o botão de virar entidade usa isto. */
  sugestao?: string;
}

/**
 * Mudar um documento de caminho.
 *
 * Renomear uma entidade move a pasta inteira — o `README.md`, as imagens ao
 * lado e as entidades contidas — e reescreve toda citação do caminho antigo,
 * tudo num commit só. Antes de gravar, o que vai acontecer fica à vista.
 */
export function MudarCaminho({
  path,
  acervo,
  textos,
  carregando,
  onCarregar,
  onGravar,
  sugestao,
}: Props) {
  const [destino, setDestino] = useState(sugestao ?? path);
  const [titulo, setTitulo] = useState<string | null>(null);

  const plano: Plano | null = useMemo(() => {
    if (!acervo || !textos || destino.trim() === path) return null;
    return planejarMudanca(path, destino.trim(), acervo, textos);
  }, [acervo, textos, path, destino]);

  // O título proposto só entra depois que o Criador o vê; enquanto ele não
  // mexer, vale o que o plano sugeriu.
  const tituloFinal = titulo ?? plano?.tituloProposto ?? '';

  const gravar = (): void => {
    if (!plano || plano.erro) return;
    const mudancas: Mudanca[] = [];
    const reescritos = new Map(plano.reescritos);

    // O título acompanha o nome da pasta (§6), mas só se for para acompanhar.
    if (tituloFinal && plano.tituloProposto) {
      const atual = reescritos.get(destino) ?? textos?.get(path) ?? '';
      reescritos.set(destino, definirTitulo(atual, tituloFinal));
    }

    for (const { de, para } of plano.arquivos) {
      // Documento reescrito entra como texto; o resto reaproveita o blob, sem
      // reenviar um byte de imagem.
      if (reescritos.has(para)) continue;
      const sha = acervo?.get(de);
      if (sha) mudancas.push({ tipo: 'blob', path: para, sha });
    }
    for (const [caminho, texto] of reescritos) {
      mudancas.push({ tipo: 'texto', path: caminho, conteudo: texto });
    }
    for (const { de } of plano.arquivos) {
      mudancas.push({ tipo: 'remover', path: de });
    }

    onGravar(mudancas, `acervo: ${path} passa a ser ${destino}`, destino);
  };

  if (!acervo) {
    return <p className="editor__dica">A lista do acervo ainda não chegou.</p>;
  }

  if (!textos) {
    return (
      <div className="painel__corpo">
        <p className="editor__dica">
          Para saber quem cita este documento é preciso ler os outros. São {acervo.size} arquivos, e
          só se lê uma vez.
        </p>
        <button type="button" className="editor__botao" onClick={onCarregar} disabled={carregando}>
          {carregando ? 'Lendo o acervo…' : 'Ler o acervo'}
        </button>
      </div>
    );
  }

  return (
    <div className="painel__corpo">
      <label className="editor__mensagem">
        <span className="editor__rotulo">Caminho novo</span>
        <span className="editor__campo">
          <input
            type="text"
            value={destino}
            onChange={(event) => {
              setDestino(event.target.value);
              setTitulo(null);
            }}
            spellCheck={false}
          />
        </span>
      </label>

      {plano?.erro ? (
        <p className="editor__estado editor__estado--erro">{plano.erro}</p>
      ) : null}

      {plano && !plano.erro ? (
        <>
          {plano.tituloProposto ? (
            <label className="editor__mensagem">
              <span className="editor__rotulo">Título, que o §6 manda acompanhar a pasta</span>
              <span className="editor__campo">
                <input
                  type="text"
                  value={tituloFinal}
                  onChange={(event) => setTitulo(event.target.value)}
                />
              </span>
            </label>
          ) : null}

          <div className="mover__listas">
            <div>
              <p className="mover__titulo">
                {plano.arquivos.length} arquivo(s) mudam de lugar
              </p>
              <ul className="mover__lista">
                {plano.arquivos.map(({ de, para }) => (
                  <li key={de}>
                    <code>{de}</code> → <code>{para}</code>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mover__titulo">
                {plano.citacoes.length === 0
                  ? 'Nenhuma citação precisa mudar'
                  : `${plano.citacoes.length} citação(ões) em ${plano.reescritos.size} documento(s)`}
              </p>
              <ul className="mover__lista">
                {plano.citacoes.map((citacao, indice) => (
                  <li key={`${citacao.documento}-${indice}`}>
                    <code>{citacao.documento}</code>: <code>{citacao.escrita}</code> →{' '}
                    <code>{citacao.nova}</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="editor__dica">
            Tudo isto entra como <strong>um</strong> commit: ou vai inteiro, ou não vai. O registro
            de alterações não é tocado — ele é histórico datado.
          </p>

          <button type="button" className="editor__botao editor__botao--forte" onClick={gravar}>
            Mudar de caminho
          </button>
        </>
      ) : null}
    </div>
  );
}
