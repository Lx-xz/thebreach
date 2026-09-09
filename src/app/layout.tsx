import type { Metadata } from 'next';
import { Cormorant_Garamond, Fraunces, Inter, Spectral } from 'next/font/google';
import { AppearanceProvider } from '@/components/AppearanceProvider';
import { AppShell, type NavCategory } from '@/components/AppShell';
import { getCompendium, getSearchIndex } from '@/lib/breach/api';
import { DEFAULT_LAYOUT, LAYOUT_IDS, STORAGE_KEYS } from '@/lib/layouts';
import '@/styles/main.scss';

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
};

/**
 * Aplica layout e tema guardados antes da primeira pintura.
 * Sem isto haveria um piscar do layout padrão a cada navegação direta.
 */
const APPEARANCE_SCRIPT = `(function(){try{var d=document.documentElement;
var l=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.layout)});
if(l&&${JSON.stringify([...LAYOUT_IDS])}.indexOf(l)>-1){d.setAttribute('data-layout',l);}
var t=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.theme)});
if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){d.setAttribute('data-theme','dark');}
}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const compendium = await getCompendium();
  const searchRecords = await getSearchIndex();

  const nav: NavCategory[] = compendium.categories.map((category) => ({
    slug: category.slug,
    number: category.number,
    title: category.title,
    count: category.docs.length,
    docs: category.docs.map((doc) => ({ slug: doc.slug, title: doc.title })),
  }));

  return (
    <html
      lang="pt-BR"
      data-layout={DEFAULT_LAYOUT}
      data-theme="light"
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
