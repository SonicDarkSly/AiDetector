import type { Signal } from '../signal/signal.js';
import { AI_VENDORS, VENDOR_LABELS, type Vendor, type VendorLevel } from '../signal/vendor.js';
import type { SoftwareHint } from './software.js';

export interface OriginScore {
  id: string;
  kind: 'ia' | 'logiciel';
  label: string;
  score: number | null;
  level: VendorLevel;
  reasons: string[];
  vendor?: Vendor;
}

const STRENGTH_FACTOR: Record<Signal['strength'], number> = { fort: 3, moyen: 2, faible: 1, info: 0.5 };

/**
 * Répartit la probabilité « IA » globale entre les assistants. Sans trace propre à l'un d'eux,
 * chacun reçoit la même part : on ne favorise pas l'assistant le plus répandu.
 */
export function evaluateOrigins(
  signals: Signal[],
  software: SoftwareHint[],
  aiProbability: number | null,
): OriginScore[] {
  const evidence = new Map<Vendor, { sum: number; trace: boolean; reasons: string[] }>();
  for (const s of signals) {
    if (s.direction !== 'ia' || !s.vendors) continue;
    for (const h of s.vendors) {
      if (h.vendor === 'script') continue;
      const e = evidence.get(h.vendor) ?? { sum: 0, trace: false, reasons: [] };
      e.sum += h.weight * STRENGTH_FACTOR[s.strength];
      if (h.weight >= 2 && (s.strength === 'fort' || s.strength === 'moyen')) e.trace = true;
      if (!e.reasons.includes(s.label)) e.reasons.push(s.label);
      evidence.set(h.vendor, e);
    }
  }

  const weights = AI_VENDORS.map((v) => Math.exp(evidence.get(v)?.sum ?? 0));
  const total = weights.reduce((a, w) => a + w, 0);

  const ai: OriginScore[] = AI_VENDORS.map((vendor, i) => {
    const e = evidence.get(vendor);
    return {
      id: vendor,
      kind: 'ia',
      label: VENDOR_LABELS[vendor],
      score: aiProbability === null ? null : Math.round(aiProbability * (weights[i] / total) * 100),
      level: e ? (e.trace ? 'trace' : 'indice') : 'aucun',
      reasons: e?.reasons ?? [],
      vendor,
    };
  });

  const tools: OriginScore[] = software.map((t) => ({
    id: `tool:${t.name.toLowerCase()}`,
    kind: 'logiciel',
    label: t.name,
    score: t.confidence,
    level: 'trace',
    reasons: t.aiNote ? [t.source, t.aiNote] : [t.source],
  }));

  return [...tools, ...ai].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
