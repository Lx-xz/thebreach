import Link from 'next/link';
import { ArrowRight, BookMarked, History, ScrollText, Sparkles } from 'lucide-react';
import { getCompendium } from '@/lib/breach/api';
import {
  CategoryCard,
  Chip,
  DocSections,
  Hero,
  MarkerLegend,
  PageHead,
} from '@/components/content';
import { MARKERS, MARKER_ORDER } from '@/lib/breach/markers';

/**
 * Página inicial. O texto é o README da raiz do acervo, renderizado como
 * qualquer outro documento; entre a abertura e as seções entram os números e
 * a grade de categorias, que são do site e não do acervo.
 */
export default async function HomePage() {
  const compendium = await getCompendium();
  const { stats, readme } = compendium;
  const lastChange = compendium.changelog[0];

  return (
    <div className="stack">
      {readme?.hero ? <Hero src={readme.hero} alt="Vista das montanhas do mundo conhecido, com um dragão em voo" /> : null}

      <div>
        <PageHead eyebrow="Acervo" title={readme?.title ?? 'Compêndio Breach'}>
          <div className="chips">
            <Chip
              label="Fonte"
              value={`${compendium.source.owner}/${compendium.source.repo}`}
              icon={<BookMarked size={13} aria-hidden="true" />}
            />
            {readme?.header.status ? <Chip label="Status" value={readme.header.status} status /> : null}
            {stats.updatedAt ? <Chip label="Última atualização" value={stats.updatedAt} /> : null}
          </div>
        </PageHead>

        {readme?.introHtml ? (
          <div className="doc__intro prose" dangerouslySetInnerHTML={{ __html: readme.introHtml }} />
        ) : null}
      </div>

      <section className="stats">
        <div className="stat">
          <span className="stat__value">{stats.docs}</span>
          <span className="stat__label">documentos</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.categories}</span>
          <span className="stat__label">categorias</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.markers.CANONICO ?? 0}</span>
          <span className="stat__label">afirmações canônicas</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.gaps}</span>
          <span className="stat__label">seções em lacuna</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.narratives}</span>
          <span className="stat__label">narrativas-fonte</span>
        </div>
      </section>

      <section>
        <div className="section-title">
          <h2>Categorias</h2>
          <Link href="/compendio">
            índice canônico <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid">
          {compendium.categories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </section>

      {readme ? (
        <article className="doc">
          <DocSections sections={readme.sections} />
        </article>
      ) : null}

      <section>
        <div className="section-title">
          <h2>Como ler os marcadores</h2>
          <Link href="/convencoes">
            convenções <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
        <div className="panel">
          <p className="card__text" style={{ marginBottom: 'var(--space-5)' }}>
            Toda afirmação do acervo carrega a camada de onde vem. Sem marcador, a afirmação não é
            considerada documentada.
          </p>
          <MarkerLegend />
        </div>
      </section>

      <section>
        <div className="section-title">
          <h2>Lacunas prioritárias</h2>
          <Link href="/compendio">
            ver tudo <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid">
          {compendium.priorityGaps.map((gap) => (
            <div className="card card--empty" key={gap.lacuna}>
              <span className="card__num">
                <ScrollText size={13} aria-hidden="true" /> impacto {gap.impacto || '—'}
              </span>
              <h3 className="card__title">{gap.lacuna}</h3>
              <p className="card__text">{gap.onde}</p>
            </div>
          ))}
          {compendium.priorityGaps.length === 0 ? (
            <p className="empty">Nenhuma lacuna prioritária registrada.</p>
          ) : null}
        </div>
      </section>

      {lastChange ? (
        <section>
          <div className="section-title">
            <h2>Última passagem editorial</h2>
            <Link href="/alteracoes">
              registro completo <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <div className="panel">
            <p className="timeline__date">
              <History size={13} aria-hidden="true" /> {lastChange.date}
            </p>
            <h3 className="timeline__title">{lastChange.title}</h3>
            <div className="prose" dangerouslySetInnerHTML={{ __html: lastChange.html }} />
          </div>
        </section>
      ) : null}

      <section className="panel card--ghost">
        <p className="panel__title">
          <Sparkles size={13} aria-hidden="true" /> Estado do acervo
        </p>
        <p className="card__text">
          {MARKER_ORDER.filter((id) => stats.markers[id])
            .map((id) => `${stats.markers[id]} ${MARKERS[id].label.toLowerCase()}`)
            .join(' · ')}
          {compendium.contradictions.length === 0
            ? ' — nenhuma contradição em aberto.'
            : ` — ${compendium.contradictions.length} contradição(ões) em aberto.`}
        </p>
      </section>
    </div>
  );
}
