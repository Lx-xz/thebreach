import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBacklinks, getCategories, getCategory, getDoc } from '@/lib/breach/api';
import { Crumbs, DocArticle, Hero, PageHead } from '@/components/content';

// O slug de um documento tem um trecho por pasta de entidade: uma espécie
// dentro da classe vira `dragoes/dragao-barbado`. Daí a rota catch-all.
type Params = { categoria: string; documento: string[] };

export async function generateStaticParams(): Promise<Params[]> {
  const categories = await getCategories();
  return categories.flatMap((category) =>
    category.docs.map((doc) => ({ categoria: category.slug, documento: doc.slug.split('/') })),
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categoria, documento } = await params;
  const doc = await getDoc(categoria, documento.join('/'));
  if (!doc) return { title: 'Documento não encontrado' };
  return { title: doc.title, description: doc.excerpt };
}

export default async function DocPage({ params }: { params: Promise<Params> }) {
  const { categoria, documento } = await params;
  const [doc, category] = await Promise.all([
    getDoc(categoria, documento.join('/')),
    getCategory(categoria),
  ]);
  if (!doc || !category) notFound();

  const backlinks = await getBacklinks(doc.path);
  const eyebrow = doc.header.subtipo
    ? `${category.title} › ${doc.header.subtipo}`
    : doc.kind === 'narrativa'
      ? 'Narrativa-fonte'
      : category.title;

  // Entidades acima desta no acervo: a classe, quando o documento é a espécie.
  const ancestors = documento.slice(0, -1).map((_, i) => {
    const slug = documento.slice(0, i + 1).join('/');
    return category.docs.find((outro) => outro.slug === slug) ?? null;
  });

  return (
    <div>
      {doc.hero ? <Hero src={doc.hero} alt={`Ilustração — ${doc.title}`} /> : null}
      <Crumbs
        trail={[
          { href: '/', label: 'Compêndio' },
          { href: `/c/${category.slug}`, label: category.title },
          ...ancestors
            .filter((ancestor) => ancestor !== null)
            .map((ancestor) => ({
              href: `/c/${category.slug}/${ancestor.slug}`,
              label: ancestor.title,
            })),
          { label: doc.title },
        ]}
      />
      <PageHead eyebrow={eyebrow} title={doc.title} />
      <DocArticle doc={doc} backlinks={backlinks} />
    </div>
  );
}
