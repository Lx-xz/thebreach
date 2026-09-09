import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompendium } from '@/lib/breach/api';
import { DocArticle, MarkerLegend, PageHead } from '@/components/content';

export const metadata: Metadata = {
  title: 'Convenções',
  description: 'Regras de escrita válidas para todo o acervo: marcadores, fontes internas e modelo de documento.',
};

export default async function ConventionsPage() {
  const compendium = await getCompendium();
  const doc = compendium.conventions;
  if (!doc) notFound();

  return (
    <div>
      <PageHead
        eyebrow="00-meta"
        title={doc.title}
        lede={doc.excerpt}
      />
      <div className="panel" style={{ marginBottom: 'var(--space-7)' }}>
        <p className="panel__title">Os seis marcadores</p>
        <MarkerLegend />
      </div>
      <DocArticle doc={doc} semIntro />
    </div>
  );
}
