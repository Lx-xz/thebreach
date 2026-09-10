'use client';

import { useEffect, useState } from 'react';

/**
 * Acompanha uma media query sem divergir na hidratação: começa `false` nos dois
 * lados e só passa a valer depois da montagem, quando há janela para medir.
 */
export function useMedia(consulta: string): boolean {
  const [bate, setBate] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(consulta);
    const sync = (): void => setBate(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [consulta]);
  return bate;
}

/** Acima disto as duas laterais são coluna; abaixo, gaveta e tela de dedo. */
export const LARGO = '(min-width: 48rem)';
