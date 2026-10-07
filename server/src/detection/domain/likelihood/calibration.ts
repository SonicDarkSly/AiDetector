export const CALIBRATION = {
  minTokens: 20,
  fullReliabilityTokens: 60,
  maxLogit: 3.5,
  // textes IA du corpus : 250 tokens max, pas d'extrapolation au-delà
  maxCalibratedTokens: 240,
  maxTokens: 250,
  // seuil réglé par longueur pour signaler au plus 5 % des textes humains du corpus
  falsePositiveTarget: 0.05,
  buckets: [30, 50, 80, 120, 200],
};

// les trois mesures du modèle de langage, et la longueur sur laquelle elles portent
export interface Measures {
  tokens: number;
  meanLogProb: number;
  meanEntropy: number;
  criterion: number;
}

export const FEATURES = ['meanLogProb', 'meanEntropy', 'criterionPerToken', 'logTokens'] as const;
export type FeatureName = (typeof FEATURES)[number];

export function featureValue(name: FeatureName, m: Measures): number {
  switch (name) {
    case 'meanLogProb':
      return m.meanLogProb;
    case 'meanEntropy':
      return m.meanEntropy;
    // le critère Fast-DetectGPT croît comme la racine de la longueur
    case 'criterionPerToken':
      return m.criterion / Math.sqrt(m.tokens);
    case 'logTokens':
      return Math.log(Math.min(m.tokens, CALIBRATION.maxCalibratedTokens));
  }
}

export interface Feature {
  mean: number;
  sd: number;
  weight: number;
}

export interface Threshold {
  tokens: number;
  offset: number;
}

export interface MeasuredRate {
  tokens: number;
  detected: number;
  falsePositives: number;
}

export interface Coefficients {
  features: Record<FeatureName, Feature>;
  bias: number;
  thresholds: Threshold[];
}

export interface Calibration extends Coefficients {
  version: 2;
  origin: 'origine' | 'personnalisée';
  texts: { ai: number; human: number };
  answers: number;
  rates: MeasuredRate[];
  appliedAt: string | null;
}

// produit par scripts/corpus/export.mjs à partir de server/calibration-samples.json
export const DEFAULT_CALIBRATION: Calibration = {
  version: 2,
  features: {
    meanLogProb: { mean: -2.2857, sd: 0.634, weight: 0.6101 },
    meanEntropy: { mean: 2.117, sd: 0.5398, weight: -0.3328 },
    criterionPerToken: { mean: -0.0763, sd: 0.135, weight: 0.7473 },
    logTokens: { mean: 4.4628, sd: 0.7093, weight: -0.2212 },
  },
  bias: -0.1958,
  thresholds: [
    { tokens: 30, offset: 1.5936 },
    { tokens: 50, offset: 1.5701 },
    { tokens: 80, offset: 1.1173 },
    { tokens: 120, offset: 0.9889 },
    { tokens: 200, offset: 0.9861 },
  ],
  origin: 'origine',
  texts: { ai: 240, human: 400 },
  answers: 0,
  rates: [
    { tokens: 30, detected: 0.21, falsePositives: 0.05 },
    { tokens: 50, detected: 0.22, falsePositives: 0.05 },
    { tokens: 80, detected: 0.26, falsePositives: 0.05 },
    { tokens: 120, detected: 0.24, falsePositives: 0.05 },
    { tokens: 200, detected: 0.21, falsePositives: 0.05 },
  ],
  appliedAt: null,
};

let active: Calibration = DEFAULT_CALIBRATION;

export function activeCalibration(): Calibration {
  return active;
}

export function useCalibration(calibration: Calibration | null): void {
  active = calibration ?? DEFAULT_CALIBRATION;
}

export function corpusLabel(c: Calibration = active): string {
  const base = `${c.texts.ai + c.texts.human} textes en français : ${c.texts.ai} générés par IA, ${c.texts.human} écrits par des humains`;
  return c.answers ? `${base} (dont ${c.answers} réponses données dans l'app)` : `${base} avant 2022`;
}
