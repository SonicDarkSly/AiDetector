import { TECHNICAL_CATEGORIES, type Signal } from '../signal/signal.js';
import { VENDOR_LABELS, type Vendor, type VendorScore } from '../signal/vendor.js';
import type { TextStats } from '../text/text-stats.js';

export type Confidence = 'faible' | 'moyenne' | 'élevée';

export interface Verdict {
  score: number;
  technicalScore: number;
  styleScore: number;
  modelScore: number | null;
  verdict: string;
  undetermined: boolean;
  confidence: Confidence;
  summary: string;
  vendors: VendorScore[];
}

export interface ModelEstimate {
  probability: number;
  reliability: number;
}

const STRENGTH_FACTOR: Record<Signal['strength'], number> = { fort: 3, moyen: 2, faible: 1, info: 0.5 };
const MAX_STYLE_POINTS = 45;

const saturate = (points: number, k: number) => Math.round(100 * (1 - Math.exp(-Math.max(0, points) / k)));
const isTechnical = (s: Signal) => TECHNICAL_CATEGORIES.includes(s.category);
const isModel = (s: Signal) => s.category === 'model';
const isStyle = (s: Signal) => !isTechnical(s) && !isModel(s);
const sum = (xs: Signal[]) => xs.reduce((a, s) => a + s.points, 0);

export function evaluate(signals: Signal[], stats: TextStats, model: ModelEstimate | null = null): Verdict {
  const tech = sum(signals.filter(isTechnical));
  const modelPoints = sum(signals.filter(isModel));
  // Le style seul ne doit jamais suffire à affirmer une origine IA.
  const style = Math.min(MAX_STYLE_POINTS, sum(signals.filter(isStyle)));

  // sans mesure du modèle, l'a priori est « plutôt humain » ; avec, la probabilité calibrée suffit
  const prior = -2 * (1 - (model?.reliability ?? 0));
  const z = (tech + 0.6 * style + modelPoints) / 11 + prior;
  const score = Math.min(99, Math.max(1, Math.round(100 / (1 + Math.exp(-z)))));

  const iaSignals = signals.filter((s) => s.direction === 'ia');
  const humanSignals = signals.filter((s) => s.direction === 'humain' && s.points !== 0);
  const strongTech = iaSignals.some((s) => s.strength === 'fort' && isTechnical(s));
  const mediumTech = iaSignals.some((s) => s.strength === 'moyen' && isTechnical(s));
  const anyIa = iaSignals.some((s) => s.points > 0);
  const modelReliable = model !== null && model.reliability >= 0.5;

  // Ne rien trouver ne veut pas dire « humain » : sur un texte court et propre, on ne conclut pas.
  const undetermined =
    !strongTech &&
    !mediumTech &&
    !modelReliable &&
    humanSignals.length === 0 &&
    (!anyIa || (stats.words < 80 && score < 50));

  return {
    score,
    technicalScore: saturate(tech, 30),
    styleScore: saturate(style, 30),
    modelScore: model ? Math.round(model.probability * 100) : null,
    verdict: verdictLabel(
      score,
      strongTech,
      iaSignals.some((s) => isTechnical(s) && s.points > 0),
      undetermined,
    ),
    undetermined,
    confidence: undetermined
      ? 'faible'
      : confidence(strongTech, mediumTech, stats.words, saturate(style, 30), model),
    summary: summarize(signals, stats, strongTech, undetermined, model),
    vendors: attribute(signals),
  };
}

function verdictLabel(score: number, strongTech: boolean, anyTech: boolean, undetermined: boolean): string {
  if (undetermined) return 'Indéterminable : aucune trace exploitable';
  if (score >= 85 && strongTech) return 'Généré par IA, trace technique détectée';
  if (score >= 85 || (score >= 70 && anyTech)) return 'Très probablement généré par IA';
  if (score >= 50) return 'Probablement généré ou retravaillé par IA';
  if (score >= 30) return 'Indices faibles, impossible de conclure';
  return "Aucun indice d'IA détecté";
}

function confidence(
  strongTech: boolean,
  mediumTech: boolean,
  words: number,
  styleScore: number,
  model: ModelEstimate | null,
): Confidence {
  if (strongTech) return 'élevée';
  if (mediumTech) return 'moyenne';
  if (model && model.reliability >= 0.9 && (model.probability > 0.9 || model.probability < 0.1))
    return 'moyenne';
  if (words < 150) return 'faible';
  return styleScore >= 60 || styleScore <= 10 ? 'moyenne' : 'faible';
}

function summarize(
  signals: Signal[],
  stats: TextStats,
  strongTech: boolean,
  undetermined: boolean,
  model: ModelEstimate | null,
): string {
  if (undetermined) {
    return stats.words < 150
      ? `Texte court (${stats.words} mots) sans trace technique, trop court aussi pour une mesure fiable par le modèle. Copié proprement, un texte d'IA de cette taille ne se distingue pas d'un texte humain. Analysez plutôt le fichier d'origine ou un texte plus long.`
      : "Ni trace technique ni indice exploitable : rien ne permet de trancher. Un texte d'IA retouché ne laisse pas forcément de trace.";
  }
  const ia = signals.filter((s) => s.direction === 'ia');
  const nTech = ia.filter(isTechnical).length;
  const nStyle = ia.filter(isStyle).length;
  const nHuman = signals.filter((s) => s.direction === 'humain').length;
  const parts = [
    nTech ? `${nTech} trace(s) technique(s)` : 'aucune trace technique',
    `${nStyle} indice(s) de style`,
    nHuman ? `${nHuman} marque(s) humaine(s)` : null,
  ].filter(Boolean);
  let summary = `${parts.join(', ')}.`;
  if (strongTech) {
    summary += ' Au moins une trace quasi certaine a été trouvée.';
  } else if (model && model.reliability >= 0.5) {
    summary +=
      ' Sans trace technique, le verdict repose surtout sur la mesure statistique du modèle de langage : un indice solide sur un texte long, jamais une preuve.';
  } else if (!nTech) {
    summary += " Sans trace technique, le résultat repose sur le style : c'est une tendance, pas une preuve.";
  }
  return summary;
}

function attribute(signals: Signal[]): VendorScore[] {
  const acc = new Map<Vendor, { sum: number; reasons: string[] }>();
  for (const s of signals) {
    if (s.direction !== 'ia' || !s.vendors) continue;
    for (const h of s.vendors) {
      const e = acc.get(h.vendor) ?? { sum: 0, reasons: [] };
      e.sum += h.weight * STRENGTH_FACTOR[s.strength];
      if (!e.reasons.includes(s.label)) e.reasons.push(s.label);
      acc.set(h.vendor, e);
    }
  }
  return [...acc]
    .map(([vendor, e]) => ({
      vendor,
      label: VENDOR_LABELS[vendor],
      score: Math.min(100, Math.round(e.sum * 8)),
      reasons: e.reasons,
    }))
    .sort((a, b) => b.score - a.score);
}
