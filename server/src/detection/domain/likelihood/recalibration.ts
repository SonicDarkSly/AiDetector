import {
  CALIBRATION,
  DEFAULT_CALIBRATION,
  FEATURES,
  featureValue,
  type Calibration,
  type Coefficients,
  type Feature,
  type FeatureName,
  type Measures,
  type MeasuredRate,
  type Threshold,
} from './calibration.js';
import type { Answer } from './calibration.store.js';
import { logitWith, offsetAt, rawLogit } from './likelihood.policy.js';

export interface Sample extends Measures {
  group: number;
  ai: boolean;
  weight: number;
}

const FOLDS = 5;
const ITERATIONS = 3000;
const LEARNING_RATE = 0.1;
const L2 = 0.01;

type Weights = Pick<Coefficients, 'features' | 'bias'>;

export function fitWeights(samples: Sample[]): Weights {
  const k = FEATURES.length;
  const raw = samples.map((s) => FEATURES.map((name) => featureValue(name, s)));
  const total = samples.reduce((a, s) => a + s.weight, 0);
  const mean = FEATURES.map((_, j) => samples.reduce((a, s, i) => a + s.weight * raw[i][j], 0) / total);
  const sd = FEATURES.map((_, j) =>
    Math.sqrt(samples.reduce((a, s, i) => a + s.weight * (raw[i][j] - mean[j]) ** 2, 0) / total),
  );
  const x = raw.map((r) => r.map((v, j) => (v - mean[j]) / sd[j]));
  const y = samples.map((s) => (s.ai ? 1 : 0));

  // classes équilibrées : le corpus compte bien plus de textes humains que de textes IA
  const aiWeight = samples.reduce((a, s) => a + (s.ai ? s.weight : 0), 0) / total;
  const w = samples.map((s) => s.weight * (s.ai ? 0.5 / aiWeight : 0.5 / (1 - aiWeight)));

  const b = new Array<number>(k).fill(0);
  let c = 0;
  const n = samples.length;
  for (let it = 0; it < ITERATIONS; it++) {
    const g = new Array<number>(k).fill(0);
    let gc = 0;
    for (let i = 0; i < n; i++) {
      const z = x[i].reduce((a, v, j) => a + v * b[j], c);
      const d = (1 / (1 + Math.exp(-z)) - y[i]) * w[i];
      for (let j = 0; j < k; j++) g[j] += d * x[i][j];
      gc += d;
    }
    for (let j = 0; j < k; j++) b[j] -= LEARNING_RATE * (g[j] / n + L2 * b[j]);
    c -= LEARNING_RATE * (gc / n);
  }
  const features = Object.fromEntries(
    FEATURES.map((name, j) => [name, { mean: mean[j], sd: sd[j], weight: b[j] }]),
  ) as Record<FeatureName, Feature>;
  return { features, bias: c };
}

function seededOrder(groups: number[]): number[] {
  let state = 42;
  const next = () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
  const order = [...groups];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const bucketOf = (tokens: number) =>
  CALIBRATION.buckets.reduce((best, b) => (Math.abs(b - tokens) < Math.abs(best - tokens) ? b : best));

// scores obtenus sur des textes jamais vus à l'entraînement (validation croisée regroupée par texte)
function outOfFoldScores(samples: Sample[]): number[] {
  const groups = seededOrder([...new Set(samples.map((s) => s.group))]);
  const fold = new Map(groups.map((g, i) => [g, i % FOLDS]));
  const scores = new Array<number>(samples.length).fill(0);
  for (let f = 0; f < FOLDS; f++) {
    const weights = fitWeights(samples.filter((s) => fold.get(s.group) !== f));
    samples.forEach((s, i) => {
      if (fold.get(s.group) === f) scores[i] = rawLogit(weights, s);
    });
  }
  return scores;
}

// pour chaque longueur, le score que seuls 5 % des textes humains dépassent
function thresholdsFor(samples: Sample[], scores: number[]): Threshold[] {
  return CALIBRATION.buckets.flatMap((tokens) => {
    const human = samples
      .map((s, i) => ({ s, score: scores[i] }))
      .filter(({ s }) => !s.ai && bucketOf(s.tokens) === tokens)
      .sort((a, b) => a.score - b.score);
    const total = human.reduce((a, { s }) => a + s.weight, 0);
    if (!total) return [];
    let cumulated = 0;
    const at = human.find(
      ({ s }) => (cumulated += s.weight) >= (1 - CALIBRATION.falsePositiveTarget) * total,
    );
    return [{ tokens, offset: at?.score ?? human[human.length - 1].score }];
  });
}

function ratesFor(samples: Sample[], flagged: boolean[]): MeasuredRate[] {
  return CALIBRATION.buckets.flatMap((tokens) => {
    const rows = samples
      .map((s, i) => ({ s, hit: flagged[i] }))
      .filter(({ s }) => bucketOf(s.tokens) === tokens);
    const share = (ai: boolean) => {
      const part = rows.filter(({ s }) => s.ai === ai);
      const weight = part.reduce((a, { s }) => a + s.weight, 0);
      return weight ? part.reduce((a, { s, hit }) => a + (hit ? s.weight : 0), 0) / weight : null;
    };
    const detected = share(true);
    const falsePositives = share(false);
    if (detected === null || falsePositives === null) return [];
    return [{ tokens, detected: round(detected), falsePositives: round(falsePositives) }];
  });
}

// coefficients sur tout le corpus, seuils et taux tirés des scores de validation croisée
export function calibrate(samples: Sample[]): {
  coefficients: Coefficients;
  rates: MeasuredRate[];
  flagged: boolean[];
} {
  const scores = outOfFoldScores(samples);
  const thresholds = thresholdsFor(samples, scores);
  const flagged = samples.map((s, i) => scores[i] - offsetAt(thresholds, s.tokens) > 0);
  return {
    coefficients: { ...fitWeights(samples), thresholds },
    rates: ratesFor(samples, flagged),
    flagged,
  };
}

const round = (x: number) => Math.round(x * 100) / 100;

// une réponse vaut un texte du corpus, qui y figure en moyenne sous 5 longueurs
export const ANSWER_WEIGHT = 5;
export const MIN_ANSWERS = 20;

export interface Proposal {
  calibration: Calibration;
  current: { rates: MeasuredRate[]; correct: number };
  proposed: { correct: number };
  answersUsed: number;
}

// une mesure ne vaut que pour le modèle qui l'a faite, et doit porter les trois mesures
export function usableAnswers(answers: Answer[], model: string | null): Answer[] {
  return answers.filter(
    (a) =>
      a.domain === 'prose' &&
      a.tokens >= CALIBRATION.minTokens &&
      a.model === model &&
      a.meanEntropy !== undefined &&
      a.criterion !== undefined,
  );
}

export function propose(
  base: Sample[],
  answers: Answer[],
  current: Calibration,
  model: string | null,
): Proposal | null {
  const usable = usableAnswers(answers, model);
  if (usable.length < MIN_ANSWERS) return null;
  const firstGroup = Math.max(...base.map((s) => s.group)) + 1;
  const extra: Sample[] = usable.map((a, i) => ({
    group: firstGroup + i,
    ai: a.label === 'ai',
    tokens: a.tokens,
    meanLogProb: a.meanLogProb,
    meanEntropy: a.meanEntropy ?? 0,
    criterion: a.criterion ?? 0,
    weight: ANSWER_WEIGHT,
  }));
  const all = [...base, ...extra];
  const { coefficients, rates, flagged } = calibrate(all);
  const correct = (hits: boolean[]) => extra.filter((s, i) => hits[i] === s.ai).length;
  const ai = usable.filter((a) => a.label === 'ai').length;
  return {
    calibration: {
      version: 2,
      ...coefficients,
      origin: 'personnalisée',
      texts: {
        ai: DEFAULT_CALIBRATION.texts.ai + ai,
        human: DEFAULT_CALIBRATION.texts.human + usable.length - ai,
      },
      answers: usable.length,
      rates,
      appliedAt: null,
    },
    current: {
      rates: current.rates,
      correct: correct(extra.map((s) => logitWith(current, s) > 0)),
    },
    proposed: { correct: correct(flagged.slice(base.length)) },
    answersUsed: usable.length,
  };
}
