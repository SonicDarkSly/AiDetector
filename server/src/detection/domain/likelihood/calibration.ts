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
  // sous cette longueur, Binoculars repère moins bien que les trois mesures (8 % contre 18 % à 30 tokens)
  binocularsFromTokens: 50,
};

// les mesures du modèle de langage, et la longueur sur laquelle elles portent
export interface Measures {
  tokens: number;
  meanLogProb: number;
  meanEntropy: number;
  criterion: number;
  // absent si le modèle de base (observateur Binoculars) n'est pas disponible
  binoculars?: number;
}

export type FeatureName = 'meanLogProb' | 'meanEntropy' | 'criterionPerToken' | 'logTokens' | 'binoculars';

// les deux formules : trois mesures du modèle Instruct, ou score Binoculars (base et Instruct)
export const MEASURES_FEATURES: FeatureName[] = [
  'meanLogProb',
  'meanEntropy',
  'criterionPerToken',
  'logTokens',
];
export const BINOCULARS_FEATURES: FeatureName[] = ['binoculars', 'logTokens'];

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
    case 'binoculars':
      return m.binoculars ?? Number.NaN;
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
  features: Partial<Record<FeatureName, Feature>>;
  bias: number;
  thresholds: Threshold[];
}

// une formule calibrée, avec les taux mesurés en validation croisée
export interface Formula extends Coefficients {
  rates: MeasuredRate[];
}

export interface Calibration {
  version: 3;
  measures: Formula;
  // null tant que le corpus n'a pas de mesures Binoculars
  binoculars: Formula | null;
  origin: 'origine' | 'personnalisée';
  texts: { ai: number; human: number };
  answers: number;
  // taux de la règle complète : trois mesures sur texte court, Binoculars au-delà
  rates: MeasuredRate[];
  appliedAt: string | null;
}

// produit par scripts/corpus/export.mjs à partir de server/calibration-samples.json
export const DEFAULT_CALIBRATION: Calibration = {
  version: 3,
  measures: {
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
    rates: [
      { tokens: 30, detected: 0.21, falsePositives: 0.05 },
      { tokens: 50, detected: 0.22, falsePositives: 0.05 },
      { tokens: 80, detected: 0.26, falsePositives: 0.05 },
      { tokens: 120, detected: 0.24, falsePositives: 0.05 },
      { tokens: 200, detected: 0.21, falsePositives: 0.05 },
    ],
  },
  binoculars: {
    features: {
      binoculars: { mean: 1.0975, sd: 0.1493, weight: -1.0337 },
      logTokens: { mean: 4.4628, sd: 0.7093, weight: -0.0897 },
    },
    bias: -0.128,
    thresholds: [
      { tokens: 30, offset: 1.6094 },
      { tokens: 50, offset: 1.167 },
      { tokens: 80, offset: 0.9351 },
      { tokens: 120, offset: 0.837 },
      { tokens: 200, offset: 0.6089 },
    ],
    rates: [
      { tokens: 30, detected: 0.1, falsePositives: 0.05 },
      { tokens: 50, detected: 0.24, falsePositives: 0.05 },
      { tokens: 80, detected: 0.29, falsePositives: 0.05 },
      { tokens: 120, detected: 0.29, falsePositives: 0.05 },
      { tokens: 200, detected: 0.37, falsePositives: 0.05 },
    ],
  },
  origin: 'origine',
  texts: { ai: 240, human: 400 },
  answers: 0,
  rates: [
    { tokens: 30, detected: 0.21, falsePositives: 0.05 },
    { tokens: 50, detected: 0.24, falsePositives: 0.05 },
    { tokens: 80, detected: 0.29, falsePositives: 0.05 },
    { tokens: 120, detected: 0.29, falsePositives: 0.05 },
    { tokens: 200, detected: 0.37, falsePositives: 0.05 },
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

// Binoculars dès qu'il est mesuré et calibré, sauf sur texte court
export function usesBinoculars(c: Calibration, m: Pick<Measures, 'tokens' | 'binoculars'>): boolean {
  return c.binoculars !== null && m.binoculars !== undefined && m.tokens >= CALIBRATION.binocularsFromTokens;
}

export function formulaFor(c: Calibration, m: Measures): Formula {
  return usesBinoculars(c, m) && c.binoculars ? c.binoculars : c.measures;
}

export function corpusLabel(c: Calibration = active): string {
  const base = `${c.texts.ai + c.texts.human} textes en français : ${c.texts.ai} générés par IA, ${c.texts.human} écrits par des humains`;
  return c.answers ? `${base} (dont ${c.answers} réponses données dans l'app)` : `${base} avant 2022`;
}
