import Link from 'next/link';
import type { Metadata } from 'next';
import { AlertTriangle, ScrollText } from 'lucide-react';
import { getCompendium } from '@/lib/breach/api';
import { Chip, PageHead } from '@/components/content';

export const metadata: Metadata = {
  title: 'Índice canônico',
  description: 'Uma linha por entidade do universo, com status, arquivo e fato central.',
};

export default async function CompendiumPage() {
  const compendium = await getCompendium();

  const grouped = compendium.index.reduce<Map<string, typeof compendium.index>>((map, entry) => {
    const list = map.get(entry.categoria) ?? [];
    list.push(entry);
    map.set(entry.categoria, list);
    return map;
  }, new Map());

  return (
    <div className="stack">
      <PageHead
        eyebrow="00-meta"
        title="Índice canônico"
        lede="Registro compacto de todas as entidades do universo. É ele que permite detectar contradições e lacunas sem varrer o acervo inteiro."
      >
        <div className="chips">
          <Chip label="Entidades" value={String(compendium.index.length)} />
          <Chip label="Contradições" value={String(compendium.contradictions.length)} />
          <Chip label="Lacunas prioritárias" value={String(compendium.priorityGaps.length)} />
        </div>
      </PageHead>

      {[...grouped.entries()].map(([categoria, entries]) => (
        <section key={categoria}>
          <div className="section-title">
            <h2>{categoria}</h2>
          </div>
          <div className="md-table">
            <table>
              <thead>
                <tr>
                  <th>Entidade</th>
                  <th>Status</th>
                  <th>Fato central</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={`${entry.categoria}-${entry.entidade}`}>
                    <td>
                      {entry.href ? (
                        <Link href={entry.href} className="doc-ref">
                          {entry.entidade}
                        </Link>
                      ) : (
                        entry.entidade
                      )}
                    </td>
                    <td>
                      <span className={`marker marker--${entry.status.toLowerCase() === 'canônico' ? 'canonico' : 'proposta'}`}>
                        <span className="marker__label">{entry.status}</span>
                      </span>
                    </td>
                    <td>{entry.fato}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="panel">
        <p className="panel__title">
          <AlertTriangle size={13} aria-hidden="true" /> Contradições em aberto
        </p>
        {compendium.contradictions.length === 0 ? (
          <p className="card__text">Nenhuma contradição detectada no acervo.</p>
        ) : (
          <div className="md-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Descrição</th>
                  <th>Documentos</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {compendium.contradictions.map((row) => (
                  <tr key={row.n}>
                    <td>{row.n}</td>
                    <td>{row.descricao}</td>
                    <td>{row.documentos}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <p className="panel__title">
          <ScrollText size={13} aria-hidden="true" /> Lacunas prioritárias
        </p>
        <div className="md-table">
          <table>
            <thead>
              <tr>
                <th>Lacuna</th>
                <th>Onde</th>
                <th>Impacto</th>
              </tr>
            </thead>
            <tbody>
              {compendium.priorityGaps.map((row) => (
                <tr key={row.lacuna}>
                  <td>{row.lacuna}</td>
                  <td>
                    <code>{row.onde}</code>
                  </td>
                  <td>{row.impacto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
