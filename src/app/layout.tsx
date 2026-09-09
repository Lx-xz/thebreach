import type { Metadata } from 'next';
import { Cormorant_Garamond, Fraunces, Inter, Spectral } from 'next/font/google';
import { AppearanceProvider } from '@/components/AppearanceProvider';
import { AppShell, type NavCategory, type NavDoc } from '@/components/AppShell';
import type { DocNode } from '@/lib/breach/types';
import { getCompendium, getSearchIndex } from '@/lib/breach/api';
import { DEFAULT_NAV, DEFAULT_TOOLS, STORAGE_KEYS } from '@/lib/layouts';
import { BASE_PATH } from '@/lib/breach/slug';
import '@/styles/main.sass';

const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-fraunces',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

const spectral = Spectral({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Compêndio Breach',
    template: '%s · Compêndio Breach',
  },
  description:
    'Representação visual do acervo do universo Breach: cosmologia, geografia, povos, bestiário, forças, história, instituições, artefatos e narrativas.',
  applicationName: 'Compêndio Breach',
  icons: { icon: [{ url: `${BASE_PATH}/favicon.svg`, type: 'image/svg+xml' }] },
};

/**
 * Aplica tema e estado da barra lateral antes da primeira pintura.
 * Sem isto a página piscaria no layout padrão a cada navegação direta.
 */
const APPEARANCE_SCRIPT = `(function(){try{var d=document.documentElement;
var t=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.theme)});
if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){d.setAttribute('data-theme','dark');}
var n=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.nav)});
if(n==='pinned'||n==='floating'){d.setAttribute('data-nav',n);}
var f=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.tools)});
if(f==='open'||f==='closed'){d.setAttribute('data-tools',f);}
}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const compendium = await getCompendium();
  const searchRecords = await getSearchIndex();

  const navDocs = (nodes: DocNode[]): NavDoc[] =>
    nodes.map((node) => ({
      slug: node.doc.slug,
      title: node.doc.title,
      children: navDocs(node.children),
    }));

  const nav: NavCategory[] = compendium.categories.map((category) => ({
    slug: category.slug,
    number: category.number,
    title: category.title,
    count: category.docs.length,
    docs: navDocs(category.tree),
  }));

  return (
    <html
      lang="pt-BR"
      data-theme="light"
      data-nav={DEFAULT_NAV}
      data-tools={DEFAULT_TOOLS}
      className={`${cormorant.variable} ${fraunces.variable} ${inter.variable} ${spectral.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body>
        <AppearanceProvider>
          <AppShell nav={nav} searchRecords={searchRecords} repoUrl={compendium.source.url}>
            {children}
          </AppShell>
        </AppearanceProvider>
      </body>
    </html>
  );
}
