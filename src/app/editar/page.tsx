'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHead } from '@/components/content';
import { DiffView } from '@/components/DiffView';
import { useAppearance } from '@/components/AppearanceProvider';
import { GithubApiError, gravarArquivo, lerArquivo, type Gravacao } from '@/lib/breach/github';
import {
  apagarRascunho,
  gravarRascunho,
  lerRascunho,
  quandoFoi,
  type Rascunho,
} from '@/lib/breach/rascunho';
import { parseCategoryDir } from '@/lib/breach/slug';

/** O documento está aberto para edição, ou não chegou a abrir. */
type Estado = 'carregando' | 'aberto' | 'inacessivel';

/** Onde está a gravação: parada, a caminho, ou barrada por conflito. */
type EstadoGravacao = 'parada' | 'enviando' | 'conflito';

/** Espera antes de guardar o rascunho, para não escrever a cada tecla. */
const ESPERA_RASCUNHO = 800;

function Editor() {
  const path = useSearchParams().get('doc') ?? '';
  const { admin, token } = useAppearance();

  const [estado, setEstado] = useState<Estado>('carregando');
  const [gravacao, setGravacao] = useState<EstadoGravacao>('parada');
  const [erro, setErro] = useState('');

  // `original` é o que veio do GitHub: a base do diff e do teste de mudança.
  const [original, setOriginal] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [sha, setSha] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [remoto, setRemoto] = useState<{ conteudo: string; sha: string } | null>(null);
  const [rascunhoAchado, setRascunhoAchado] = useState<Rascunho | null>(null);
  const [gravado, setGravado] = useState<Gravacao | null>(null);
  const [verDiff, setVerDiff] = useState(false);

  const sujo = conteudo !== original;

  // A mensagem de commit segue o CLAUDE.md do acervo: uma passagem por commit,
  // com o assunto na frente. O assunto sai do caminho, não da digitação.
  const prefixo = useMemo(() => {
    const categoria = parseCategoryDir(path.split('/')[0] ?? '');
    return categoria ? categoria.slug : null;
  }, [path]);

  useEffect(() => {
    if (!path || !token) return undefined;
    let cancelado = false;
    setEstado('carregando');
    setErro('');

    lerArquivo(path, token)
      .then((arquivo) => {
        if (cancelado) return;
        if (!arquivo) {
          setErro(`${path} não existe no acervo.`);
          setEstado('inacessivel');
          return;
        }
        setOriginal(arquivo.conteudo);
        setConteudo(arquivo.conteudo);
        setSha(arquivo.sha);
        setEstado('aberto');

        // O rascunho nunca se aplica sozinho: aplicá-lo esconderia do Criador o
        // que está de fato no acervo. Ele é anunciado, e ele decide.
        const guardado = lerRascunho(path);
        if (guardado && guardado.conteudo !== arquivo.conteudo) setRascunhoAchado(guardado);
        else if (guardado) apagarRascunho(path);
      })
      .catch((error: unknown) => {
        if (cancelado) return;
        setErro(error instanceof GithubApiError ? error.message : 'Falha ao falar com o GitHub.');
        setEstado('inacessivel');
      });

    return () => {
      cancelado = true;
    };
  }, [path, token]);

  // O rascunho só é escrito, nunca apagado aqui: depois de um conflito ele é a
  // única cópia do que foi digitado, e apagá-lo por conta própria perderia tudo.
  useEffect(() => {
    if (estado !== 'aberto' || !sujo) return undefined;
    const tempo = window.setTimeout(() => {
      gravarRascunho(path, { sha, conteudo, mensagem, em: Date.now() });
    }, ESPERA_RASCUNHO);
    return () => window.clearTimeout(tempo);
  }, [estado, sujo, path, sha, conteudo, mensagem]);

  useEffect(() => {
    if (!sujo) return undefined;
    const avisar = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sujo]);

  if (!path) {
    return (
      <PageHead eyebrow="Modo administrador" title="Editar">
        <p className="editor__estado">
          Falta o documento: abra esta página a partir do link “Editar” de uma entidade.
        </p>
      </PageHead>
    );
  }

  if (!admin || !token) {
    return (
      <PageHead eyebrow="Modo administrador" title={path}>
        <p className="editor__estado">
          Modo administrador desligado. Aperte <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> para colar o
          token e ativar.
        </p>
      </PageHead>
    );
  }

  const enviar = async (shaAlvo: string): Promise<void> => {
    const texto = mensagem.trim();
    if (!texto) return;
    setGravacao('enviando');
    setErro('');
    setGravado(null);

    try {
      const feito = await gravarArquivo(
        path,
        conteudo,
        shaAlvo,
        prefixo ? `${prefixo}: ${texto}` : texto,
        token,
      );
      setOriginal(conteudo);
      setSha(feito.sha);
      setMensagem('');
      setRemoto(null);
      setRascunhoAchado(null);
      setVerDiff(false);
      apagarRascunho(path);
      setGravado(feito);
      setGravacao('parada');
    } catch (error: unknown) {
      if (error instanceof GithubApiError && error.conflito) {
        // O arquivo mudou no GitHub. Recarregar para mostrar o que mudou, e
        // deixar a decisão com o Criador — nunca passar por cima em silêncio.
        const atual = await lerArquivo(path, token).catch(() => null);
        if (atual) {
          setRemoto(atual);
          setGravacao('conflito');
          setErro(error.message);
          return;
        }
      }
      setErro(error instanceof GithubApiError ? error.message : 'Falha ao falar com o GitHub.');
      setGravacao('parada');
    }
  };

  /** Larga a edição da tela e volta ao que está no GitHub, guardando o texto. */
  const recarregarDoConflito = (): void => {
    if (!remoto) return;
    const meu: Rascunho = { sha, conteudo, mensagem, em: Date.now() };
    gravarRascunho(path, meu);
    setRascunhoAchado(meu);
    setOriginal(remoto.conteudo);
    setConteudo(remoto.conteudo);
    setSha(remoto.sha);
    setRemoto(null);
    setGravacao('parada');
    setErro('');
  };

  const enviando = gravacao === 'enviando';
  const podeGravar = sujo && mensagem.trim().length > 0 && !enviando;

  return (
    <PageHead eyebrow="Modo administrador" title={path}>
      <div className="editor">
        {estado === 'carregando' ? <p className="editor__estado">Carregando…</p> : null}

        {erro ? (
          <p className="editor__estado editor__estado--erro" role="alert">
            {erro}
          </p>
        ) : null}

        {estado === 'aberto' ? (
          <>
            {rascunhoAchado ? (
              <div className="editor__rascunho">
                <p>
                  Há um rascunho deste documento, de {quandoFoi(rascunhoAchado.em)}.
                  {rascunhoAchado.sha !== sha
                    ? ' O arquivo mudou no GitHub depois que ele foi guardado.'
                    : ''}
                </p>
                <div className="editor__acoes">
                  <button
                    type="button"
                    className="editor__botao"
                    onClick={() => {
                      setConteudo(rascunhoAchado.conteudo);
                      setMensagem(rascunhoAchado.mensagem);
                      setRascunhoAchado(null);
                    }}
                  >
                    Recuperar
                  </button>
                  <button
                    type="button"
                    className="editor__botao editor__botao--fraco"
                    onClick={() => {
                      apagarRascunho(path);
                      setRascunhoAchado(null);
                    }}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ) : null}

            <textarea
              className="editor__area"
              value={conteudo}
              onChange={(event) => {
                setConteudo(event.target.value);
                setGravado(null);
              }}
              spellCheck
              aria-label={`Markdown de ${path}`}
              // `readOnly` e não `disabled`: no telefone, desabilitar o campo
              // fecha o teclado e perde a posição da rolagem.
              readOnly={enviando}
            />

            {gravacao === 'conflito' && remoto ? (
              <div className="editor__conflito">
                <p className="editor__conflito-aviso">
                  O arquivo mudou no GitHub depois que esta página o abriu. Abaixo, o que está lá
                  agora contra o que está na sua tela.
                </p>
                <DiffView
                  antes={remoto.conteudo}
                  depois={conteudo}
                  rotulo={{ antes: 'no GitHub agora', depois: 'na sua tela' }}
                />
                <div className="editor__acoes">
                  <button type="button" className="editor__botao" onClick={recarregarDoConflito}>
                    Recarregar do GitHub
                  </button>
                  <button
                    type="button"
                    className="editor__botao editor__botao--forte"
                    onClick={() => void enviar(remoto.sha)}
                  >
                    Gravar por cima
                  </button>
                </div>
                <p className="editor__dica">
                  Recarregar larga o texto da tela, mas guarda uma cópia dele no rascunho deste
                  navegador.
                </p>
              </div>
            ) : null}

            <label className="editor__mensagem">
              <span className="editor__rotulo">O que entrou no acervo</span>
              <span className="editor__campo">
                {prefixo ? <span className="editor__prefixo">{prefixo}:</span> : null}
                <input
                  type="text"
                  value={mensagem}
                  onChange={(event) => setMensagem(event.target.value)}
                  placeholder="registra o porte da espécie"
                  disabled={enviando}
                />
              </span>
            </label>

            <div className="editor__acoes">
              <button
                type="button"
                className="editor__botao"
                onClick={() => setVerDiff((atual) => !atual)}
                disabled={!sujo}
              >
                {verDiff ? 'Esconder o que muda' : 'Ver o que muda'}
              </button>
              <button
                type="button"
                className="editor__botao editor__botao--forte"
                onClick={() => void enviar(sha)}
                disabled={!podeGravar}
              >
                {enviando ? 'Gravando…' : 'Gravar no acervo'}
              </button>
            </div>

            {verDiff && sujo ? <DiffView antes={original} depois={conteudo} /> : null}

            {gravado ? (
              <p className="editor__gravado">
                Gravado no acervo.{' '}
                <a href={gravado.commitUrl} target="_blank" rel="noreferrer">
                  Ver o commit
                </a>
                . O site reconstrói sozinho em cerca de um minuto.
              </p>
            ) : null}

            {!sujo && !gravado ? (
              <p className="editor__dica">Nada mudou ainda — o texto é igual ao do acervo.</p>
            ) : null}
          </>
        ) : null}
      </div>
    </PageHead>
  );
}

export default function EditarPage() {
  return (
    <Suspense fallback={<PageHead eyebrow="Modo administrador" title="Editar" />}>
      <Editor />
    </Suspense>
  );
}
