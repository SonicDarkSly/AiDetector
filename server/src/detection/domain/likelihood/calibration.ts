export const CALIBRATION = {
  minTokens: 20,
  fullReliabilityTokens: 60,
  maxLogit: 3.5,
  // textes IA du corpus : 240 tokens max, pas d'extrapolation au-delà
  maxCalibratedTokens: 240,
  maxTokens: 250,
  // seuil relevé sur texte court pour signaler au plus 5 % de textes humains
  caution: { offset: 1.5, perLogToken: 1.0, fromTokens: 30 },
};

export interface Feature {
  mean: number;
  sd: number;
  weight: number;
}

export interface MeasuredRate {
  tokens: number;
  detected: number;
  falsePositives: number;
}

export interface Coefficients {
  meanLogProb: Feature;
  logTokens: Feature;
  bias: number;
}

export interface Calibration extends Coefficients {
  origin: 'origine' | 'personnalisée';
  texts: { ai: number; human: number };
  answers: number;
  rates: MeasuredRate[];
  appliedAt: string | null;
}

export const DEFAULT_CALIBRATION: Calibration = {
  meanLogProb: { mean: -2.8994, sd: 0.8327, weight: 3.118 },
  logTokens: { mean: 4.1803, sd: 0.6111, weight: -1.0039 },
  bias: -2.4819,
  origin: 'origine',
  texts: { ai: 46, human: 348 },
  answers: 0,
  rates: [
    { tokens: 30, detected: 0.63, falsePositives: 0.05 },
    { tokens: 50, detected: 0.8, falsePositives: 0.04 },
    { tokens: 80, detected: 0.97, falsePositives: 0.04 },
    { tokens: 120, detected: 0.96, falsePositives: 0.05 },
    { tokens: 200, detected: 0.86, falsePositives: 0.01 },
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
