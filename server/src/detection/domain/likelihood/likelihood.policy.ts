import type { Signal } from '../signal/signal.js';
import {
  CALIBRATION,
  activeCalibration,
  corpusLabel,
  featureValue,
  formulaFor,
  usesBinoculars,
  type Calibration,
  type Coefficients,
  type FeatureName,
  type Measures,
  type MeasuredRate,
  type Threshold,
} from './calibration.js';
import type { LikelihoodMeasure } from './likelihood-scorer.js';
import type { TextDomain } from '../text/genre.js';

// score brut de la régression, avant le seuil propre à chaque longueur
export function rawLogit(c: Pick<Coefficients, 'features' | 'bias'>, m: Measures): number {
  return Object.entries(c.features).reduce((z, [name, f]) => {
    return z + (f.weight * (featureValue(name as FeatureName, m) - f.mean)) / f.sd;
  }, c.bias);
}

// seuil interpolé (en log des tokens) entre les longueurs mesurées, constant au-delà
export function offsetAt(thresholds: Threshold[], tokens: number): number {
  if (thresholds.length === 0) return 0;
  const sorted = [...thresholds].sort((a, b) => a.tokens - b.tokens);
  if (tokens <= sorted[0].tokens) return sorted[0].offset;
  const last = sorted[sorted.length - 1];
  if (tokens >= last.tokens) return last.offset;
  const i = sorted.findIndex((t) => t.tokens >= tokens);
  const [a, b] = [sorted[i - 1], sorted[i]];
  const t = (Math.log(tokens) - Math.log(a.tokens)) / (Math.log(b.tokens) - Math.log(a.tokens));
  return a.offset + t * (b.offset - a.offset);
}

// > 0 : au-delà de ce que 95 % des textes humains du corpus atteignent à cette longueur
export function scoreWith(c: Coefficients, m: Measures): number {
  const z = rawLogit(c, m) - offsetAt(c.thresholds, m.tokens);
  return Math.max(-CALIBRATION.maxLogit, Math.min(CALIBRATION.maxLogit, z));
}

export function logitWith(c: Calibration, m: Measures): number {
  return scoreWith(formulaFor(c, m), m);
}

export function aiLogit(m: LikelihoodMeasure): number {
  return logitWith(activeCalibration(), m);
}

export function aiProbability(m: LikelihoodMeasure): number {
  return 1 / (1 + Math.exp(-aiLogit(m)));
}

export function reliability(tokens: number): number {
  const { minTokens, fullReliabilityTokens } = CALIBRATION;
  return Math.max(0, Math.min(1, (tokens - minTokens) / (fullReliabilityTokens - minTokens)));
}

// taux de la formule réellement utilisée pour ce texte
export function measuredAt(m: Pick<Measures, 'tokens' | 'binoculars'>): MeasuredRate {
  const c = activeCalibration();
  const rates = usesBinoculars(c, m) && c.binoculars ? c.binoculars.rates : c.measures.rates;
  return rates.reduce((best, r) =>
    Math.abs(r.tokens - m.tokens) < Math.abs(best.tokens - m.tokens) ? r : best,
  );
}

// côté humain ce n'est qu'un faible indice : avec un seuil à 5 % de fausses alertes, la plupart des
// textes d'IA restent sous le seuil (retouchés, techniques, familiers ou en vers aussi)
const HUMAN_CAP: Record<TextDomain, number> = { prose: 5, technical: 2, verse: 0 };

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function likelihoodSignal(m: LikelihoodMeasure, domain: TextDomain = 'prose'): Signal {
  const p = aiProbability(m);
  const r = reliability(m.tokens);
  const points = Math.max(-HUMAN_CAP[domain], Math.round(11 * r * aiLogit(m)));
  const ref = measuredAt(m);
  const binoculars = usesBinoculars(activeCalibration(), m);
  const evidence = [
    `Modèle : ${m.model}, ${m.tokens} tokens en ${(m.elapsedMs / 1000).toFixed(1)} s`,
    `Log-probabilité moyenne : ${m.meanLogProb.toFixed(2)} · entropie moyenne : ${m.meanEntropy.toFixed(2)} · Fast-DetectGPT : ${m.criterion.toFixed(2)}`,
    m.binoculars === undefined
      ? 'Binoculars : non mesuré (modèle de base absent), décision sur les trois mesures'
      : `Binoculars : ${m.binoculars.toFixed(3)} (bas = IA) · décision sur ${binoculars ? 'Binoculars' : `les trois mesures (texte de moins de ${CALIBRATION.binocularsFromTokens} tokens)`}`,
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
      : `Prévisibilité sous le seuil d'alerte (${pct(p)})`,
    detail: ia
      ? "Les mots choisis sont plus prévisibles que ceux de 95 % des textes humains du corpus à cette longueur : c'est la signature statistique d'un texte généré. Attention, un texte humain très formel (encyclopédie, presse) peut aussi s'en approcher."
      : "Le texte n'atteint pas le seuil réglé pour ne signaler à tort que 5 % des textes humains. Cela ne prouve pas qu'un humain l'a écrit : la plupart des textes d'IA restent aussi sous ce seuil, surtout retouchés, techniques ou familiers.",
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
