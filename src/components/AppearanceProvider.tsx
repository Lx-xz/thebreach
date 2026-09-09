'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_NAV,
  DEFAULT_THEME,
  STORAGE_KEYS,
  isNavMode,
  type NavMode,
  type ThemeId,
} from '@/lib/layouts';

interface Appearance {
  theme: ThemeId;
  toggleTheme: () => void;
  /** `pinned`: a barra lateral fica sempre aberta em telas largas. */
  nav: NavMode;
  setNav: (mode: NavMode) => void;
  /** Gaveta aberta por cima do conteúdo (telas estreitas ou modo flutuante). */
  drawer: boolean;
  setDrawer: (open: boolean) => void;
}

const AppearanceContext = createContext<Appearance | null>(null);

function remember(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* navegação privada: a escolha vale só para esta sessão */
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [nav, setNavState] = useState<NavMode>(DEFAULT_NAV);
  const [drawer, setDrawer] = useState(false);

  // Alinha o estado do React com o que o script inline já aplicou no <html>.
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.theme === 'dark') setTheme('dark');
    if (isNavMode(root.dataset.nav)) setNavState(root.dataset.nav);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: ThemeId = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      remember(STORAGE_KEYS.theme, next);
      return next;
    });
  }, []);

  const setNav = useCallback((mode: NavMode) => {
    setNavState(mode);
    document.documentElement.dataset.nav = mode;
    remember(STORAGE_KEYS.nav, mode);
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme, nav, setNav, drawer, setDrawer }),
    [theme, toggleTheme, nav, setNav, drawer],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): Appearance {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance precisa estar dentro de AppearanceProvider.');
  return context;
}
