'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { useAppearance } from './AppearanceProvider';

/** Leva à edição de `path`. Só aparece com o modo administrador ligado. */
export function EditarLink({ path }: { path: string }) {
  const { admin } = useAppearance();
  if (!admin) return null;
  return (
    <Link className="editarlink" href={`/editar/?doc=${encodeURIComponent(path)}`}>
      <Pencil size={14} aria-hidden="true" />
      Editar
    </Link>
  );
}
