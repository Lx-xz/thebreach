'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHead } from '@/components/content';
import { Cabecalho } from '@/components/Cabecalho';
import { DiffView } from '@/components/DiffView';
import { Previa } from '@/components/Previa';
import { useAppearance } from '@/components/AppearanceProvider';
import { definirCampo, hoje } from '@/lib/breach/cabecalho';
import { conferirTexto } from '@/lib/breach/conferir';
import {
  GithubApiError,
  gravarArquivo,
  lerArquivo,
  listarArvore,
  type Gravacao,
} from '@/lib/breach/github';
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
  const [insistindo, setInsistindo] = useState(false);

  // `undefined` enquanto carrega; `null` quando a conferência não está
  // disponível — o GitHub cortou a árvore, ou a chamada falhou.
  const [arquivos, setArquivos] = useState<Set<string> | null | undefined>(undefined);

  const sujo = conteudo !== original;

  // A mensagem de commit segue o CLAUDE.md do acervo: uma passagem por commit,
  // com o assunto na frente. O assunto sai do caminho, não da digitação.
  const prefixo = useMemo(() => {
    const categoria = parseCategoryDir(path.split('/')[0] ?? '');
    return categoria ? categoria.slug : null;
  }, [path]);

  /**
   * O texto que de fato vai para o acervo.
   *
   * O CLAUDE.md do acervo manda atualizar a data em cada documento tocado, e o
   * editor cumpre sozinho. Diff, conferência e `PUT` olham este mesmo texto, de
   * modo que a data aparece no diff antes de gravar e nunca é surpresa. O
   * carimbo só existe quando há mudança: abrir um documento não o suja.
   */
  const paraGravar = useMemo(
    () => (sujo ? definirCampo(conteudo, 'Última atualização', hoje()) : conteudo),
    [sujo, conteudo],
  );

  const achados = useMemo(
    () => (arquivos ? conferirTexto(path, paraGravar, arquivos) : []),
    [arquivos, path, paraGravar],
  );
  const barrado = achados.length > 0 && !insistindo;

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

  // A lista de arquivos do acervo, buscada uma vez: serve à conferência e à
  // ilustração de abertura da prévia.
  useEffect(() => {
    if (!token) return undefined;
    let cancelado = false;
    listarArvore(token)
      .then((lista) => {
        if (!cancelado) setArquivos(lista);
      })
      .catch(() => {
        if (!cancelado) setArquivos(null);
      });
    return () => {
      cancelado = true;
    };
  }, [token]);

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

  /** Uma mudança no texto, venha da área de texto ou do formulário. */
  const mudar = (novo: string): void => {
    setConteudo(novo);
    setGravado(null);
    setInsistindo(false);
  };

  const enviar = async (shaAlvo: string): Promise<void> => {
    const texto = mensagem.trim();
    if (!texto) return;
    const enviado = paraGravar;
    setGravacao('enviando');
    setErro('');
    setGravado(null);

    try {
      const feito = await gravarArquivo(
        path,
        enviado,
        shaAlvo,
        prefixo ? `${prefixo}: ${texto}` : texto,
        token,
      );
      // O texto da tela passa a ser o que foi gravado, com a data já carimbada.
      setConteudo(enviado);
      setOriginal(enviado);
      setSha(feito.sha);
      setMensagem('');
      setRemoto(null);
      setRascunhoAchado(null);
      setVerDiff(false);
      setInsistindo(false);
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
                      mudar(rascunhoAchado.conteudo);
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

            <Cabecalho bruto={conteudo} onChange={mudar} somenteLeitura={enviando} />

            <div className="editor__bancada">
              <textarea
                className="editor__area"
                value={conteudo}
                onChange={(event) => mudar(event.target.value)}
                spellCheck
                aria-label={`Markdown de ${path}`}
                // `readOnly` e não `disabled`: no telefone, desabilitar o campo
                // fecha o teclado e perde a posição da rolagem.
                readOnly={enviando}
              />
              <Previa bruto={paraGravar} path={path} arquivos={arquivos ?? null} />
            </div>

            {gravacao === 'conflito' && remoto ? (
              <div className="editor__conflito">
                <p className="editor__conflito-aviso">
                  O arquivo mudou no GitHub depois que esta página o abriu. Abaixo, o que está lá
                  agora contra o que está na sua tela.
                </p>
                <DiffView
                  antes={remoto.conteudo}
                  depois={paraGravar}
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

            {achados.length ? (
              <div className="editor__achados">
                <p className="editor__achados-titulo">
                  {achados.length === 1
                    ? 'Uma referência aponta para o vazio:'
                    : `${achados.length} referências apontam para o vazio:`}
                </p>
                <ul>
                  {achados.map((achado) => (
                    <li key={achado.alvo}>
                      <code>{achado.escrita}</code> → <code>{achado.alvo}</code> não existe
                    </li>
                  ))}
                </ul>
                <p className="editor__dica">
                  É o mesmo critério que derruba a conferência do acervo. Se o documento citado
                  ainda vai ser criado, o segundo toque grava assim mesmo.
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
                  readOnly={enviando}
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
                className={`editor__botao ${barrado ? 'editor__botao--barrado' : 'editor__botao--forte'}`}
                onClick={() => (barrado ? setInsistindo(true) : void enviar(sha))}
                disabled={!podeGravar}
              >
                {enviando ? 'Gravando…' : barrado ? 'Gravar mesmo assim' : 'Gravar no acervo'}
              </button>
            </div>

            {verDiff && sujo ? <DiffView antes={original} depois={paraGravar} /> : null}

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

            {arquivos === null ? (
              <p className="editor__dica">
                Conferência de referências indisponível: não deu para listar o acervo. O CI continua
                conferindo depois do commit.
              </p>
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
