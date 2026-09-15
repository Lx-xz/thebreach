'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_NAV,
  DEFAULT_THEME,
  DEFAULT_TOOLS,
  STORAGE_KEYS,
  isNavMode,
  isToolsMode,
  type NavMode,
  type ThemeId,
  type ToolsMode,
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
  /** `open`: a lateral direita mostra os rótulos ao lado dos ícones. */
  tools: ToolsMode;
  toggleTools: () => void;
  /** Modo administrador: mostra os links de edição pelo site. */
  admin: boolean;
  /** Token pessoal do GitHub, guardado no navegador. `null` quando não há um. */
  token: string | null;
  /** Grava o token e liga o modo administrador. */
  activate: (token: string) => void;
  /** Apaga o token e desliga o modo administrador. */
  deactivate: () => void;
}

const AppearanceContext = createContext<Appearance | null>(null);

function remember(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* navegação privada: a escolha vale só para esta sessão */
  }
}

function forget(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* navegação privada: nada para apagar */
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [nav, setNavState] = useState<NavMode>(DEFAULT_NAV);
  const [tools, setToolsState] = useState<ToolsMode>(DEFAULT_TOOLS);
  const [drawer, setDrawer] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Alinha o estado do React com o que o script inline já aplicou no <html>.
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.theme === 'dark') setTheme('dark');
    if (isNavMode(root.dataset.nav)) setNavState(root.dataset.nav);
    if (isToolsMode(root.dataset.tools)) setToolsState(root.dataset.tools);
    if (root.dataset.admin === '1') setAdmin(true);
    // O token nunca passa pelo script bloqueante: só é lido aqui, depois da
    // primeira pintura.
    try {
      setToken(window.localStorage.getItem(STORAGE_KEYS.token));
    } catch {
      /* navegação privada: sem token guardado */
    }
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

  const toggleTools = useCallback(() => {
    setToolsState((current) => {
      const next: ToolsMode = current === 'open' ? 'closed' : 'open';
      document.documentElement.dataset.tools = next;
      remember(STORAGE_KEYS.tools, next);
      return next;
    });
  }, []);

  const activate = useCallback((next: string) => {
    setToken(next);
    remember(STORAGE_KEYS.token, next);
    setAdmin(true);
    document.documentElement.dataset.admin = '1';
    remember(STORAGE_KEYS.admin, '1');
  }, []);

  const deactivate = useCallback(() => {
    setToken(null);
    forget(STORAGE_KEYS.token);
    setAdmin(false);
    delete document.documentElement.dataset.admin;
    forget(STORAGE_KEYS.admin);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      nav,
      setNav,
      drawer,
      setDrawer,
      tools,
      toggleTools,
      admin,
      token,
      activate,
      deactivate,
    }),
    [theme, toggleTheme, nav, setNav, drawer, tools, toggleTools, admin, token, activate, deactivate],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): Appearance {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance precisa estar dentro de AppearanceProvider.');
  return context;
}
