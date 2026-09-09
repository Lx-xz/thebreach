/** Marcadores de confiabilidade — CONVENCOES.md §1. */

import type { MarkerId, MarkerMeta, MarkerTally } from './types';
import { deaccent } from './slug';

export const MARKERS: Record<MarkerId, MarkerMeta> = {
  CANONICO: {
    id: 'CANONICO',
    label: 'CANÔNICO',
    meaning: 'Verdade estabelecida pelo Criador. Definitiva.',
  },
  ATESTADO: {
    id: 'ATESTADO',
    label: 'ATESTADO',
    meaning: 'Observado e registrado por habitantes. Consistente com o canônico.',
  },
  CRENCA: {
    id: 'CRENCA',
    label: 'CRENÇA',
    meaning: 'Sustentado por habitantes sem verificação. Pode ser falso.',
  },
  DISPUTADO: {
    id: 'DISPUTADO',
    label: 'DISPUTADO',
    meaning: 'Versões conflitantes entre fontes do mundo.',
  },
  LACUNA: {
    id: 'LACUNA',
    label: 'LACUNA',
    meaning: 'Ainda não definido pelo Criador.',
  },
  PROPOSTA: {
    id: 'PROPOSTA',
    label: 'PROPOSTA',
    meaning: 'Sugestão pendente de aprovação. Nunca é canônico.',
  },
};

export const MARKER_ORDER: MarkerId[] = [
  'CANONICO',
  'ATESTADO',
  'CRENCA',
  'DISPUTADO',
  'LACUNA',
  'PROPOSTA',
];

/** `CANÔNICO` / `canonico` → `CANONICO`; desconhecido → `null`. */
export function normalizeMarker(raw: string): MarkerId | null {
  const key = deaccent(raw).trim().toUpperCase().replace(/\s+/g, '');
  return key in MARKERS ? (key as MarkerId) : null;
}

/**
 * Separa `[CRENÇA — Ordem dos Vigias de Pedra]` em marcador e fonte interna.
 * Aceita travessão, hífen ou dois-pontos como separador.
 */
export function parseMarkerToken(
  text: string,
): { id: MarkerId; label: string; source: string | null } | null {
  const match = /^\[\s*([^\]—:-]+?)\s*(?:[—–:-]\s*(.+?))?\s*\]$/.exec(text.trim());
  if (!match) return null;
  const id = normalizeMarker(match[1]);
  if (!id) return null;
  return { id, label: MARKERS[id].label, source: match[2]?.trim() || null };
}

/** Conta ocorrências de cada marcador no markdown bruto. */
export function tallyMarkers(markdown: string): MarkerTally {
  const tally: MarkerTally = {};
  const pattern = /`\[\s*([^\]`]+?)\s*\]`/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    const parsed = parseMarkerToken(`[${match[1]}]`);
    if (!parsed) continue;
    tally[parsed.id] = (tally[parsed.id] ?? 0) + 1;
  }
  return tally;
}

export function mergeTallies(tallies: MarkerTally[]): MarkerTally {
  const total: MarkerTally = {};
  for (const tally of tallies) {
    for (const key of Object.keys(tally) as MarkerId[]) {
      total[key] = (total[key] ?? 0) + (tally[key] ?? 0);
    }
  }
  return total;
}

export function tallyTotal(tally: MarkerTally): number {
  return Object.values(tally).reduce((sum, value) => sum + (value ?? 0), 0);
}
