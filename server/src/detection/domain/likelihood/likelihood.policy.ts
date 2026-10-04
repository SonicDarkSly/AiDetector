import type { Signal } from '../signal/signal.js';
import {
  CALIBRATION,
  activeCalibration,
  corpusLabel,
  type Coefficients,
  type MeasuredRate,
} from './calibration.js';
import type { LikelihoodMeasure } from './likelihood-scorer.js';
import type { TextDomain } from '../text/genre.js';

export function logitWith(c: Coefficients, meanLogProb: number, tokens: number): number {
  const { maxLogit, maxCalibratedTokens } = CALIBRATION;
  const z =
    c.bias +
    (c.meanLogProb.weight * (meanLogProb - c.meanLogProb.mean)) / c.meanLogProb.sd +
    (c.logTokens.weight * (Math.log(Math.min(tokens, maxCalibratedTokens)) - c.logTokens.mean)) /
      c.logTokens.sd;
  return Math.max(-maxLogit, Math.min(maxLogit, cautious(z, tokens)));
}

export function aiLogit(m: LikelihoodMeasure): number {
  return logitWith(activeCalibration(), m.meanLogProb, m.tokens);
}

function cautious(z: number, tokens: number): number {
  const { offset, perLogToken, fromTokens } = CALIBRATION.caution;
  const margin = Math.max(0, offset - perLogToken * Math.log(Math.max(tokens, fromTokens) / fromTokens));
  if (z <= 0) return z;
  return Math.max(0, z - margin);
}

export function aiProbability(m: LikelihoodMeasure): number {
  return 1 / (1 + Math.exp(-aiLogit(m)));
}

export function reliability(tokens: number): number {
  const { minTokens, fullReliabilityTokens } = CALIBRATION;
  return Math.max(0, Math.min(1, (tokens - minTokens) / (fullReliabilityTokens - minTokens)));
}

export function measuredAt(tokens: number): MeasuredRate {
  return activeCalibration().rates.reduce((best, m) =>
    Math.abs(m.tokens - tokens) < Math.abs(best.tokens - tokens) ? m : best,
  );
}

// côté humain ce n'est qu'un indice : IA retouchée, texte technique, familier ou en vers sortent pareil
const HUMAN_CAP: Record<TextDomain, number> = { prose: 15, technical: 5, verse: 0 };

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function likelihoodSignal(m: LikelihoodMeasure, domain: TextDomain = 'prose'): Signal {
  const p = aiProbability(m);
  const r = reliability(m.tokens);
  const points = Math.max(-HUMAN_CAP[domain], Math.round(11 * r * aiLogit(m)));
  const ref = measuredAt(m.tokens);
  const evidence = [
    `Modèle : ${m.model}, ${m.tokens} tokens en ${(m.elapsedMs / 1000).toFixed(1)} s`,
    `Log-probabilité moyenne : ${m.meanLogProb.toFixed(2)} · entropie moyenne : ${m.meanEntropy.toFixed(2)} · Fast-DetectGPT : ${m.criterion.toFixed(2)}`,
    `Mesuré vers ${ref.tokens} tokens : ${pct(ref.detected)} des textes IA détectés, ${pct(ref.falsePositives)} des textes humains signalés à tort`,
    `Corpus de calibration : ${corpusLabel()}`,
  ];

  if (r === 0) {
    return {
      id: 'model-likelihood',
      category: 'model',
      label: `Modèle de langage : texte trop court (${m.tokens} tokens)`,
      detail: `Sous ${CALIBRATION.minTokens} tokens, la mesure n'est pas exploitable (valeur brute : ${pct(p)}).`,
      strength: 'info',
      direction: 'neutre',
      points: 0,
      evidence,
    };
  }

  const ia = p >= 0.5;
  const extreme = p > 0.9 || p < 0.1;
  if (domain === 'verse' && !ia) {
    return {
      id: 'model-likelihood',
      category: 'model',
      label: `Texte en vers : mesure non concluante (${pct(p)})`,
      detail:
        "Le modèle n'a été calibré que sur de la prose. Rimes et images imposent des mots inattendus : un poème paraît peu prévisible, même écrit par une IA. Cette mesure ne pousse donc pas vers « humain ».",
      strength: 'info',
      direction: 'neutre',
      points: 0,
      evidence,
    };
  }
  return {
    id: 'model-likelihood',
    category: 'model',
    label: ia
      ? `Texte très prévisible pour un modèle de langage (${pct(p)})`
      : `Texte peu prévisible pour un modèle de langage (${pct(p)})`,
    detail: ia
      ? "Les mots choisis sont nettement plus probables que ce qu'un humain écrit d'habitude : c'est la signature statistique d'un texte généré."
      : "Les choix de mots sont moins attendus que ceux d'un texte généré : profil plutôt humain. Ce n'est qu'un indice : un texte d'IA retouché, très technique ou écrit dans un style familier peut aussi sortir ici.",
    strength: ia && extreme && r === 1 ? 'fort' : Math.abs(points) >= 8 ? 'moyen' : 'faible',
    direction: Math.abs(points) < 3 ? 'neutre' : ia ? 'ia' : 'humain',
    points,
    evidence: [
      ...evidence,
      ...(r < 1 ? [`Fiabilité réduite : texte court (${pct(r)})`] : []),
      ...(domain === 'technical'
        ? [
            "Document technique (code, tableaux, jargon) : mesure hors du domaine de calibration, un texte d'IA de ce type sort souvent « peu prévisible »",
          ]
        : []),
      ...(domain === 'verse'
        ? ['Texte en vers : hors du domaine de calibration, mais un poème aussi prévisible reste un indice']
        : []),
    ],
  };
}
