'use client';

import { useMemo } from 'react';
import { CAMPOS, STATUS, definirCampo, hoje, lerCampos, type Campo } from '@/lib/breach/cabecalho';

interface Props {
  /** O markdown cru inteiro: o formulário remenda linhas dentro dele. */
  bruto: string;
  onChange: (bruto: string) => void;
  somenteLeitura?: boolean;
}

/** Campos que o formulário não deixa digitar, e por quê. */
const AUTOMATICOS: Partial<Record<Campo, string>> = {
  'Última atualização': 'preenchido ao gravar',
};

function dicaDe(campo: Campo): string | null {
  if (campo === 'Classificação') return 'Bestiário › espécie';
  if (campo === 'Documentos relacionados') return '[Nome](caminho/relativo/), separados por vírgula';
  if (campo === 'Última atualização') return `vira ${hoje()} ao gravar`;
  return null;
}

/**
 * Os cinco campos do cabeçalho (CONVENCOES.md §3).
 *
 * Nada aqui monta um documento a partir de campos: cada mudança passa por
 * `definirCampo`, que troca uma linha dentro do markdown cru e não encosta em
 * mais nada. É o que mantém o diff do tamanho da mudança.
 */
export function Cabecalho({ bruto, onChange, somenteLeitura = false }: Props) {
  const campos = useMemo(() => lerCampos(bruto), [bruto]);

  // Um status fora dos três de §3 continua na lista, para não sumir sozinho.
  const statusOpcoes = useMemo(() => {
    const atual = campos.Status?.trim();
    const conhecidos = STATUS as readonly string[];
    return atual && !conhecidos.includes(atual) ? [atual, ...conhecidos] : conhecidos;
  }, [campos.Status]);

  const definir = (campo: Campo, valor: string): void => {
    onChange(definirCampo(bruto, campo, valor));
  };

  return (
    <div className="cabecalho">
      <p className="cabecalho__titulo">Cabeçalho</p>
      {CAMPOS.map((campo) => {
        const automatico = AUTOMATICOS[campo];
        const ausente = campos[campo] === null;
        return (
          <label className="cabecalho__campo" key={campo}>
            <span className="cabecalho__rotulo">
              {campo}
              {ausente ? <span className="cabecalho__ausente">falta</span> : null}
            </span>

            {campo === 'Status' ? (
              <select
                value={campos.Status ?? ''}
                onChange={(event) => definir(campo, event.target.value)}
                disabled={somenteLeitura}
              >
                {ausente ? <option value="">—</option> : null}
                {statusOpcoes.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {opcao}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={campos[campo] ?? ''}
                onChange={(event) => definir(campo, event.target.value)}
                placeholder={automatico ?? dicaDe(campo) ?? '—'}
                readOnly={somenteLeitura || Boolean(automatico)}
                spellCheck={campo !== 'Documentos relacionados'}
              />
            )}

            {dicaDe(campo) ? <span className="cabecalho__dica">{dicaDe(campo)}</span> : null}
          </label>
        );
      })}
      <p className="cabecalho__dica">
        Campo sem informação fica presente e vazio, com <code>—</code>: campo ausente é campo
        esquecido.
      </p>
    </div>
  );
}
