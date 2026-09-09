import type { Metadata } from 'next';
import { getCompendium } from '@/lib/breach/api';
import { Chip, PageHead } from '@/components/content';

export const metadata: Metadata = {
  title: 'Registro de alterações',
  description: 'Histórico editorial do acervo: decisões e mudanças de conteúdo, não commits.',
};

export default async function ChangelogPage() {
  const compendium = await getCompendium();

  return (
    <div className="stack">
      <PageHead
        eyebrow="00-meta"
        title="Registro de alterações"
        lede="Histórico editorial do acervo. Registra decisões e mudanças de conteúdo — o histórico técnico fica no Git."
      >
        <div className="chips">
          <Chip label="Passagens" value={String(compendium.changelog.length)} />
          {compendium.changelog[0] ? <Chip label="Mais recente" value={compendium.changelog[0].date} /> : null}
        </div>
      </PageHead>

      {compendium.changelog.length === 0 ? (
        <p className="empty">Nenhuma passagem registrada.</p>
      ) : (
        <ol className="timeline">
          {compendium.changelog.map((entry) => (
            <li className="timeline__item" key={`${entry.date}-${entry.title}`}>
              <p className="timeline__date">{entry.date}</p>
              <h2 className="timeline__title">{entry.title}</h2>
              <div className="prose" dangerouslySetInnerHTML={{ __html: entry.html }} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
