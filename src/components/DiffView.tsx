'use client';

import { useMemo } from 'react';
import { compararLinhas, contar } from '@/lib/breach/diff';

interface Props {
  antes: string;
  depois: string;
  /** O que cada lado representa, quando não é “o acervo” contra “o seu texto”. */
  rotulo?: { antes: string; depois: string };
}

/** O que muda entre dois textos, com os trechos iguais recortados. */
export function DiffView({ antes, depois, rotulo }: Props) {
  const linhas = useMemo(() => compararLinhas(antes, depois), [antes, depois]);
  const { mais, menos } = useMemo(() => contar(linhas), [linhas]);

  if (!linhas.length) {
    return <p className="editor__estado">Nada mudou.</p>;
  }

  return (
    <div className="editor__diff">
      <p className="editor__diff-resumo">
        <span className="editor__diff-conta editor__diff-conta--mais">+{mais}</span>
        <span className="editor__diff-conta editor__diff-conta--menos">−{menos}</span>
        {rotulo ? (
          <span className="editor__diff-lados">
            {rotulo.antes} → {rotulo.depois}
          </span>
        ) : null}
      </p>
      <div className="editor__diff-corpo">
        {linhas.map((linha, indice) =>
          linha.tipo === 'corte' ? (
            <div key={indice} className="diffline diffline--corte">
              {linha.escondidas} linhas sem mudança
            </div>
          ) : (
            <div key={indice} className={`diffline diffline--${linha.tipo}`}>
              <span className="diffline__sinal">
                {linha.tipo === 'mais' ? '+' : linha.tipo === 'menos' ? '−' : ' '}
              </span>
              {/* Uma linha em branco ainda precisa ocupar altura. */}
              <span className="diffline__texto">{linha.texto || ' '}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
