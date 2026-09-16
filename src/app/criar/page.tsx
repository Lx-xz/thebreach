'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHead } from '@/components/content';
import { DocumentoNovo } from '@/components/DocumentoNovo';
import { useAppearance } from '@/components/AppearanceProvider';
import {
  GithubApiError,
  commitarArvore,
  listarArvore,
  type Mudanca,
} from '@/lib/breach/github';
import { withBase } from '@/lib/breach/slug';

/**
 * Abrir um documento novo dentro de uma entidade.
 *
 * Fica fora da rota de edição de propósito: criar não é editar, e o lugar de
 * onde se cria é a entidade que vai conter o documento novo — a categoria, a
 * classe, a família. Por isso se chega aqui pelo botão da página de leitura
 * delas, com a pasta já escolhida.
 */
function Criar() {
  const pasta = useSearchParams().get('pasta') ?? '';
  const { admin, token } = useAppearance();

  const [arvore, setArvore] = useState<Map<string, string> | null | undefined>(undefined);
  const [erro, setErro] = useState('');
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let cancelado = false;
    listarArvore(token)
      .then((lista) => {
        if (!cancelado) setArvore(lista);
      })
      .catch((error: unknown) => {
        if (cancelado) return;
        setErro(error instanceof GithubApiError ? error.message : 'Falha ao listar o acervo.');
        setArvore(null);
      });
    return () => {
      cancelado = true;
    };
  }, [token]);

  if (!admin || !token) {
    return (
      <PageHead eyebrow="Modo administrador" title="Documento novo">
        <p className="editor__estado">
          Modo administrador desligado. Aperte <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> para colar o
          token e ativar.
        </p>
      </PageHead>
    );
  }

  const gravar = async (mudancas: Mudanca[], mensagem: string, destino: string): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await commitarArvore(mudancas, mensagem, token);
      // Documento aberto é documento para escrever: vai direto para a edição.
      window.location.href = `${withBase('/editar/')}?doc=${encodeURIComponent(destino)}`;
    } catch (error: unknown) {
      setErro(error instanceof GithubApiError ? error.message : 'Falha ao falar com o GitHub.');
      setGravando(false);
    }
  };

  return (
    <PageHead eyebrow="Modo administrador" title="Documento novo">
      <div className="editor">
        {pasta ? (
          <p className="editor__dica">
            Vai nascer dentro de <code>{pasta}/</code>
          </p>
        ) : null}

        {erro ? (
          <p className="editor__estado editor__estado--erro" role="alert">
            {erro}
          </p>
        ) : null}

        {arvore === undefined ? <p className="editor__estado">Carregando o acervo…</p> : null}

        {arvore ? (
          <div className="painel">
            <DocumentoNovo
              acervo={arvore}
              pastaInicial={pasta}
              ocupado={gravando}
              onGravar={(mudancas, mensagem, destino) => void gravar(mudancas, mensagem, destino)}
            />
          </div>
        ) : null}
      </div>
    </PageHead>
  );
}

export default function CriarPage() {
  return (
    <Suspense fallback={<PageHead eyebrow="Modo administrador" title="Documento novo" />}>
      <Criar />
    </Suspense>
  );
}
