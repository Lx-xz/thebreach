'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAppearance } from './AppearanceProvider';

interface Props {
  open: boolean;
  onClose: () => void;
}

const FOCAVEIS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo do token pessoal — a porta do modo administrador. Clona a casca de
 * `SearchDialog`, mas corrige três buracos que o original tem: aqui o Escape
 * funciona com foco em qualquer parte do painel (não só no campo), o Tab fica
 * preso dentro do diálogo, e a rolagem do corpo trava enquanto ele está aberto.
 */
export function TokenDialog({ open, onClose }: Props) {
  const { token, activate, deactivate } = useAppearance();
  const [valor, setValor] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValor('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, token]);

  useEffect(() => {
    if (!open) return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focaveis = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCAVEIS));
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  const submeter = (event: React.FormEvent): void => {
    event.preventDefault();
    const limpo = valor.trim();
    if (!limpo) return;
    activate(limpo);
    onClose();
  };

  return (
    <div
      className="searchdialog"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="searchdialog__panel tokendialog"
        role="dialog"
        aria-modal="true"
        aria-label="Modo administrador"
        onKeyDown={onKeyDown}
      >
        {token ? (
          <div className="tokendialog__body">
            <p className="tokendialog__estado">
              <ShieldCheck size={17} aria-hidden="true" />
              Token ativo, terminado em <code>…{token.slice(-4)}</code>
            </p>
            <p className="tokendialog__dica">
              Vale para <code>Lx-xz/breach</code>. Sair apaga o token deste navegador.
            </p>
            <button
              type="button"
              className="tokendialog__sair"
              onClick={() => {
                deactivate();
                onClose();
              }}
            >
              <LogOut size={16} aria-hidden="true" />
              Sair do modo administrador
            </button>
          </div>
        ) : (
          <form className="tokendialog__body" onSubmit={submeter}>
            <label className="tokendialog__rotulo" htmlFor="gh-token">
              Token pessoal do GitHub
            </label>
            <input
              ref={inputRef}
              id="gh-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={valor}
              onChange={(event) => setValor(event.target.value)}
              placeholder="github_pat_…"
            />
            <p className="tokendialog__dica">
              Fine-grained, restrito a <code>Lx-xz/breach</code>, com permissão{' '}
              <code>Contents: Read and write</code>. Fica só neste navegador.
            </p>
            <button type="submit" className="tokendialog__ativar" disabled={!valor.trim()}>
              Ativar modo administrador
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
