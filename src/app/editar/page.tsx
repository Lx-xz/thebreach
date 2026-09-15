'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHead } from '@/components/content';
import { useAppearance } from '@/components/AppearanceProvider';
import { GithubApiError, lerArquivo } from '@/lib/breach/github';

type Estado = 'carregando' | 'pronto' | 'erro';

function Editor() {
  const path = useSearchParams().get('doc') ?? '';
  const { admin, token } = useAppearance();
  const [estado, setEstado] = useState<Estado>('carregando');
  const [conteudo, setConteudo] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!path || !token) return;
    let cancelado = false;
    setEstado('carregando');
    lerArquivo(path, token)
      .then((arquivo) => {
        if (cancelado) return;
        if (!arquivo) {
          setErro(`${path} não existe no acervo.`);
          setEstado('erro');
          return;
        }
        setConteudo(arquivo.conteudo);
        setEstado('pronto');
      })
      .catch((error: unknown) => {
        if (cancelado) return;
        setErro(error instanceof GithubApiError ? error.message : 'Falha ao falar com o GitHub.');
        setEstado('erro');
      });
    return () => {
      cancelado = true;
    };
  }, [path, token]);

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

  return (
    <PageHead eyebrow="Modo administrador" title={path}>
      <div className="editor">
        {estado === 'carregando' ? <p className="editor__estado">Carregando…</p> : null}
        {estado === 'erro' ? <p className="editor__estado">{erro}</p> : null}
        {estado === 'pronto' ? (
          <>
            <textarea className="editor__area" value={conteudo} readOnly spellCheck />
            <p className="editor__estado">
              Leitura por enquanto — gravar de volta no acervo chega na próxima fase.
            </p>
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
