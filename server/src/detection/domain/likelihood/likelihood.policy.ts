import type { Signal } from '../signal/signal.js';
import { CALIBRATION, CORPUS, MEASURED } from './calibration.js';
import type { LikelihoodMeasure } from './likelihood-scorer.js';

export function aiLogit(m: LikelihoodMeasure): number {
  const { meanLogProb, logTokens, bias, maxLogit, maxCalibratedTokens } = CALIBRATION;
  const z =
    bias +
    (meanLogProb.weight * (m.meanLogProb - meanLogProb.mean)) / meanLogProb.sd +
    (logTokens.weight * (Math.log(Math.min(m.tokens, maxCalibratedTokens)) - logTokens.mean)) / logTokens.sd;
  return Math.max(-maxLogit, Math.min(maxLogit, z));
}

export function aiProbability(m: LikelihoodMeasure): number {
  return 1 / (1 + Math.exp(-aiLogit(m)));
}

export function reliability(tokens: number): number {
  const { minTokens, fullReliabilityTokens } = CALIBRATION;
  return Math.max(0, Math.min(1, (tokens - minTokens) / (fullReliabilityTokens - minTokens)));
}

function measuredAt(tokens: number) {
  return MEASURED.reduce((best, m) =>
    Math.abs(m.tokens - tokens) < Math.abs(best.tokens - tokens) ? m : best,
  );
}

const HUMAN_CAP = 15;
const TECHNICAL_HUMAN_CAP = 5;

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function likelihoodSignal(m: LikelihoodMeasure, technical = false): Signal {
  const p = aiProbability(m);
  const r = reliability(m.tokens);
  // côté humain ce n'est qu'un indice : IA retouchée, texte technique ou familier sortent pareil
  const points = Math.max(technical ? -TECHNICAL_HUMAN_CAP : -HUMAN_CAP, Math.round(11 * r * aiLogit(m)));
  const ref = measuredAt(m.tokens);
  const evidence = [
    `Modèle : ${m.model}, ${m.tokens} tokens en ${(m.elapsedMs / 1000).toFixed(1)} s`,
    `Log-probabilité moyenne : ${m.meanLogProb.toFixed(2)} · entropie moyenne : ${m.meanEntropy.toFixed(2)} · Fast-DetectGPT : ${m.criterion.toFixed(2)}`,
    `Mesuré vers ${ref.tokens} tokens : ${pct(ref.detected)} des textes IA détectés, ${pct(ref.falsePositives)} des textes humains signalés à tort`,
    `Corpus de calibration : ${CORPUS}`,
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
      ...(technical
        ? [
            "Document technique (code, tableaux, jargon) : mesure hors du domaine de calibration, un texte d'IA de ce type sort souvent « peu prévisible »",
          ]
        : []),
    ],
  };
}
