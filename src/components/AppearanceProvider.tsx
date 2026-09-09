'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LAYOUT,
  DEFAULT_THEME,
  STORAGE_KEYS,
  isLayoutId,
  type LayoutId,
  type ThemeId,
} from '@/lib/layouts';

interface Appearance {
  layout: LayoutId;
  theme: ThemeId;
  setLayout: (layout: LayoutId) => void;
  toggleTheme: () => void;
}

const AppearanceContext = createContext<Appearance | null>(null);

/**
 * Guarda layout e tema.
 *
 * O DOM é o mesmo nos quatro layouts — quem muda é a folha de estilo, através
 * do atributo `data-layout` no elemento raiz. Assim a troca é instantânea e
 * não existe divergência de hidratação entre servidor e cliente.
 */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [layout, setLayoutState] = useState<LayoutId>(DEFAULT_LAYOUT);
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  // Alinha o estado do React com o que o script inline já aplicou no <html>.
  useEffect(() => {
    const root = document.documentElement;
    const storedLayout = root.dataset.layout;
    if (isLayoutId(storedLayout)) setLayoutState(storedLayout);
    if (root.dataset.theme === 'dark') setTheme('dark');
  }, []);

  const setLayout = useCallback((next: LayoutId) => {
    setLayoutState(next);
    document.documentElement.dataset.layout = next;
    try {
      window.localStorage.setItem(STORAGE_KEYS.layout, next);
    } catch {
      /* navegação privada: a escolha vale só para esta sessão */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: ThemeId = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        window.localStorage.setItem(STORAGE_KEYS.theme, next);
      } catch {
        /* idem */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ layout, theme, setLayout, toggleTheme }),
    [layout, theme, setLayout, toggleTheme],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): Appearance {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance precisa estar dentro de AppearanceProvider.');
  return context;
}
