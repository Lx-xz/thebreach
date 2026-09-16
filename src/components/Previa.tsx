'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ImagemPronta } from '@/components/Ilustracoes';
import { semCabecalho } from '@/lib/breach/cabecalho';
import { ilustracaoDe, urlDaImagem } from '@/lib/breach/imagens';
import { renderMarkdown } from '@/lib/breach/markdown';

interface Props {
  bruto: string;
  /** Caminho do documento no acervo: é o que resolve as imagens relativas. */
  path: string;
  /** Tudo que existe no acervo, para achar a ilustração de abertura. */
  arquivos: Set<string> | null;
  /** Imagens escolhidas nesta sessão e ainda não gravadas. */
  pendentes?: ImagemPronta[];
}

/** Espera antes de renderizar, para não reprocessar a cada tecla. */
const ESPERA = 300;

/**
 * Como o documento vai ficar no site.
 *
 * Roda o **mesmo** pipeline do build — `renderMarkdown` de `markdown.ts`,
 * isomórfico de propósito. Um renderizador leve qualquer daria uma prévia
 * *parecida*, e parecida não serve: os marcadores viram medalhas, as
 * referências viram link, a ilustração de abertura sai do corpo e as tabelas
 * ganham rolagem — tudo comportamento dos plugins próprios do projeto.
 *
 * Onde a prévia **não** é idêntica à página, e por quê: a moldura das seções
 * vem de `parse.ts` e `content.tsx`, e `parse.ts` depende de `source.ts`, que
 * lê do disco e só roda no build. Daí a única diferença conhecida — a página
 * separa o número do título da seção (`Descrição geral`) e a prévia mostra o
 * título como o markdown o escreve (`1. Descrição geral`). O conteúdo dentro
 * das seções é o mesmo, conferido contra as páginas geradas.
 */
export function Previa({ bruto, path, arquivos, pendentes = [] }: Props) {
  const [html, setHtml] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    let cancelado = false;
    const tempo = window.setTimeout(() => {
      // Sem o cabeçalho: o site o desenha como ficha, não como prosa, e o
      // formulário acima já mostra os campos.
      renderMarkdown(semCabecalho(bruto), path)
        .then((saida) => {
          if (cancelado) return;
          setHtml(saida);
          setErro('');
        })
        .catch(() => {
          if (!cancelado) setErro('Não deu para renderizar este markdown.');
        });
    }, ESPERA);

    return () => {
      cancelado = true;
      window.clearTimeout(tempo);
    };
  }, [bruto, path]);

  /**
   * A imagem recém-escolhida ainda não existe no site: as ilustrações são
   * servidas de `public/acervo/`, que o build preenche. Sem esta troca ela
   * apareceria como quadro quebrado, e quadro quebrado parece falha.
   */
  const comLocais = useMemo(() => {
    let saida = html;
    for (const imagem of pendentes) {
      saida = saida.split(urlDaImagem(imagem.path)).join(imagem.objectURL);
    }
    return saida;
  }, [html, pendentes]);

  // A página real desenha a ilustração de abertura no topo, fora do corpo:
  // sem isto a prévia mostraria o documento sem a imagem que ele tem no site.
  const heroPendente = pendentes.find((imagem) => imagem.hero);
  const hero =
    heroPendente?.objectURL ??
    (arquivos ? ilustracaoDe(path, new Set([...arquivos, ...pendentes.map((i) => i.path)])) : null);

  return (
    <div className="previa">
      <p className="previa__titulo">Como vai ficar</p>
      {erro ? <p className="editor__estado editor__estado--erro">{erro}</p> : null}
      <div className="previa__folha">
        {hero ? (
          <figure className="hero">
            {/* Export estático: imagem simples, sem o otimizador do Next. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hero__art" src={hero} alt="" />
          </figure>
        ) : null}
        {/* O HTML sai do pipeline do projeto, com `allowDangerousHtml: false`. */}
        <div className="prose" dangerouslySetInnerHTML={{ __html: comLocais }} />
      </div>
    </div>
  );
}
