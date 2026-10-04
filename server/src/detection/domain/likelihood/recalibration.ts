import {
  CALIBRATION,
  DEFAULT_CALIBRATION,
  type Calibration,
  type Coefficients,
  type MeasuredRate,
} from './calibration.js';
import type { Answer } from './calibration.store.js';
import { logitWith } from './likelihood.policy.js';

export interface Sample {
  group: number;
  ai: boolean;
  tokens: number;
  meanLogProb: number;
  weight: number;
}

const BUCKETS = [30, 50, 80, 120, 200];
const FOLDS = 5;
const ITERATIONS = 3000;
const LEARNING_RATE = 0.1;
const L2 = 0.01;

const features = (s: Sample): [number, number] => [
  s.meanLogProb,
  Math.log(Math.min(s.tokens, CALIBRATION.maxCalibratedTokens)),
];

export function fitCoefficients(samples: Sample[]): Coefficients {
  const raw = samples.map(features);
  const total = samples.reduce((a, s) => a + s.weight, 0);
  const mean = [0, 1].map((j) => samples.reduce((a, s, i) => a + s.weight * raw[i][j], 0) / total);
  const sd = [0, 1].map((j) =>
    Math.sqrt(samples.reduce((a, s, i) => a + s.weight * (raw[i][j] - mean[j]) ** 2, 0) / total),
  );
  const x = raw.map((r) => [(r[0] - mean[0]) / sd[0], (r[1] - mean[1]) / sd[1]]);
  const y = samples.map((s) => (s.ai ? 1 : 0));

  // classes équilibrées : le corpus compte bien plus de textes humains que de textes IA
  const aiWeight = samples.reduce((a, s) => a + (s.ai ? s.weight : 0), 0) / total;
  const w = samples.map((s) => s.weight * (s.ai ? 0.5 / aiWeight : 0.5 / (1 - aiWeight)));

  const b = [0, 0];
  let c = 0;
  const n = samples.length;
  for (let it = 0; it < ITERATIONS; it++) {
    const g = [0, 0];
    let gc = 0;
    for (let i = 0; i < n; i++) {
      const p = 1 / (1 + Math.exp(-(x[i][0] * b[0] + x[i][1] * b[1] + c)));
      const d = (p - y[i]) * w[i];
      g[0] += d * x[i][0];
      g[1] += d * x[i][1];
      gc += d;
    }
    b[0] -= LEARNING_RATE * (g[0] / n + L2 * b[0]);
    b[1] -= LEARNING_RATE * (g[1] / n + L2 * b[1]);
    c -= LEARNING_RATE * (gc / n);
  }
  return {
    meanLogProb: { mean: mean[0], sd: sd[0], weight: b[0] },
    logTokens: { mean: mean[1], sd: sd[1], weight: b[1] },
    bias: c,
  };
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
  BUCKETS.reduce((best, b) => (Math.abs(b - tokens) < Math.abs(best - tokens) ? b : best));

// validation croisée regroupée par texte, avec le seuil prudent appliqué
export function crossValidate(samples: Sample[]): { rates: MeasuredRate[]; flagged: boolean[] } {
  const groups = seededOrder([...new Set(samples.map((s) => s.group))]);
  const fold = new Map(groups.map((g, i) => [g, i % FOLDS]));
  const flagged = new Array<boolean>(samples.length).fill(false);
  for (let f = 0; f < FOLDS; f++) {
    const coefficients = fitCoefficients(samples.filter((s) => fold.get(s.group) !== f));
    samples.forEach((s, i) => {
      if (fold.get(s.group) === f) flagged[i] = logitWith(coefficients, s.meanLogProb, s.tokens) > 0;
    });
  }
  const rates = BUCKETS.flatMap((tokens) => {
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
  return { rates, flagged };
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

// une mesure ne vaut que pour le modèle qui l'a faite
export function usableAnswers(answers: Answer[], model: string | null): Answer[] {
  return answers.filter(
    (a) => a.domain === 'prose' && a.tokens >= CALIBRATION.minTokens && a.model === model,
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
    weight: ANSWER_WEIGHT,
  }));
  const all = [...base, ...extra];
  // même méthode des deux côtés : on compare des taux mesurés de la même façon
  const baseline = current.origin === 'origine' ? crossValidate(base).rates : current.rates;
  const { rates, flagged } = crossValidate(all);
  const correct = (hits: boolean[]) => extra.filter((s, i) => hits[i] === s.ai).length;
  const ai = usable.filter((a) => a.label === 'ai').length;
  return {
    calibration: {
      ...fitCoefficients(all),
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
      rates: baseline,
      correct: correct(extra.map((s) => logitWith(current, s.meanLogProb, s.tokens) > 0)),
    },
    proposed: { correct: correct(flagged.slice(base.length)) },
    answersUsed: usable.length,
  };
}
