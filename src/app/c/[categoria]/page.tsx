import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { FolderOpen, ScrollText } from 'lucide-react';
import { getCategories, getCategory } from '@/lib/breach/api';
import { Chip, Crumbs, DocCard, PageHead } from '@/components/content';

type Params = { categoria: string };

export async function generateStaticParams(): Promise<Params[]> {
  const categories = await getCategories();
  return categories.map((category) => ({ categoria: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categoria } = await params;
  const category = await getCategory(categoria);
  if (!category) return { title: 'Categoria não encontrada' };
  return { title: category.title, description: category.description };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { categoria } = await params;
  const category = await getCategory(categoria);
  if (!category) notFound();

  return (
    <div className="stack">
      <div>
        <Crumbs trail={[{ href: '/', label: 'Compêndio' }, { label: category.title }]} />
        <PageHead eyebrow={`Categoria ${category.number}`} title={category.title} lede={category.description}>
          <div className="chips">
            <Chip label="Status" value={category.status} status />
            <Chip
              label="Documentos"
              value={String(category.docs.length)}
              icon={<FolderOpen size={13} aria-hidden="true" />}
            />
            {category.updatedAt ? <Chip label="Atualizado" value={category.updatedAt} /> : null}
          </div>
        </PageHead>
      </div>

      <section>
        <div className="section-title">
          <h2>Documentos</h2>
        </div>
        {category.docs.length > 0 ? (
          <div className="grid grid--wide">
            {category.docs.map((doc) => (
              <DocCard key={doc.path} doc={doc} />
            ))}
          </div>
        ) : (
          <p className="empty">
            Categoria ainda vazia. Nenhum documento foi aberto aqui — nada é inventado para preencher.
          </p>
        )}
      </section>

      {category.gaps.length > 0 ? (
        <section className="panel">
          <p className="panel__title">
            <ScrollText size={13} aria-hidden="true" /> Lacunas desta categoria
          </p>
          <ul className="prose">
            {category.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
