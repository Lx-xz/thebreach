'use client';

import Link from 'next/link';
import { FilePlus } from 'lucide-react';
import { useAppearance } from './AppearanceProvider';

interface Props {
  /** Pasta onde o documento novo vai nascer, ex.: `04-bestiario/aves/grifos`. */
  pasta: string;
  rotulo?: string;
}

/** Abre a criação de um documento dentro desta entidade. Só no modo administrador. */
export function CriarLink({ pasta, rotulo = 'Criar documento aqui' }: Props) {
  const { admin } = useAppearance();
  if (!admin) return null;
  return (
    <Link className="editarlink" href={`/criar/?pasta=${encodeURIComponent(pasta)}`}>
      <FilePlus size={14} aria-hidden="true" />
      {rotulo}
    </Link>
  );
}
