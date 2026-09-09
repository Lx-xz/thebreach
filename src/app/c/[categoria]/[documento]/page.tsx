import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBacklinks, getCategories, getCategory, getDoc } from '@/lib/breach/api';
import { Crumbs, DocArticle, PageHead } from '@/components/content';

type Params = { categoria: string; documento: string };

export async function generateStaticParams(): Promise<Params[]> {
  const categories = await getCategories();
  return categories.flatMap((category) =>
    category.docs.map((doc) => ({ categoria: category.slug, documento: doc.slug })),
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categoria, documento } = await params;
  const doc = await getDoc(categoria, documento);
  if (!doc) return { title: 'Documento não encontrado' };
  return { title: doc.title, description: doc.excerpt };
}

export default async function DocPage({ params }: { params: Promise<Params> }) {
  const { categoria, documento } = await params;
  const [doc, category] = await Promise.all([getDoc(categoria, documento), getCategory(categoria)]);
  if (!doc || !category) notFound();

  const backlinks = await getBacklinks(doc.path);
  const eyebrow = doc.header.subtipo
    ? `${category.title} › ${doc.header.subtipo}`
    : doc.kind === 'narrativa'
      ? 'Narrativa-fonte'
      : category.title;

  return (
    <div>
      <Crumbs
        trail={[
          { href: '/', label: 'Compêndio' },
          { href: `/c/${category.slug}`, label: category.title },
          { label: doc.title },
        ]}
      />
      <PageHead eyebrow={eyebrow} title={doc.title} />
      <DocArticle doc={doc} backlinks={backlinks} />
    </div>
  );
}
