#!/usr/bin/env node
// Compare la calibration actuelle, la même formule réentraînée, et une formule à trois mesures
// (prévisibilité, entropie, Fast-DetectGPT), par validation croisée regroupée par texte.
// Usage : node scripts/corpus/train.mjs   (après measure.mjs)
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { CORPUS_DIR, MEASURES, ROOT } from './corpus-lib.mjs';

const require = createRequire(import.meta.url);
const { CALIBRATION, DEFAULT_CALIBRATION } = require(
  join(ROOT, 'server/dist/detection/domain/likelihood/calibration.js'),
);
const { logitWith } = require(join(ROOT, 'server/dist/detection/domain/likelihood/likelihood.policy.js'));

const BUCKETS = [30, 50, 80, 120, 200];
const FOLDS = 5;
const ITERATIONS = 3000;
const LEARNING_RATE = 0.1;
const L2 = 0.01;

const logTokens = (r) => Math.log(Math.min(r.tokens, CALIBRATION.maxCalibratedTokens));
const FEATURE_SETS = {
  'réentraînée (2 mesures)': [(r) => r.meanLogProb, logTokens],
  '3 mesures': [
    (r) => r.meanLogProb,
    (r) => r.meanEntropy,
    (r) => r.criterion / Math.sqrt(r.tokens),
    logTokens,
  ],
};

function fit(rows, features) {
  const raw = rows.map((r) => features.map((f) => f(r)));
  const k = features.length;
  const mean = [...Array(k)].map((_, j) => raw.reduce((a, x) => a + x[j], 0) / raw.length);
  const sd = [...Array(k)].map((_, j) =>
    Math.sqrt(raw.reduce((a, x) => a + (x[j] - mean[j]) ** 2, 0) / raw.length),
  );
  const x = raw.map((v) => v.map((value, j) => (value - mean[j]) / sd[j]));
  const y = rows.map((r) => (r.label === 'ia' ? 1 : 0));
  // classes équilibrées
  const aiShare = y.reduce((a, b) => a + b, 0) / y.length;
  const w = y.map((v) => (v ? 0.5 / aiShare : 0.5 / (1 - aiShare)));
  const b = new Array(k).fill(0);
  let c = 0;
  for (let it = 0; it < ITERATIONS; it++) {
    const g = new Array(k).fill(0);
    let gc = 0;
    for (let i = 0; i < x.length; i++) {
      const z = x[i].reduce((a, v, j) => a + v * b[j], c);
      const d = (1 / (1 + Math.exp(-z)) - y[i]) * w[i];
      for (let j = 0; j < k; j++) g[j] += d * x[i][j];
      gc += d;
    }
    for (let j = 0; j < k; j++) b[j] -= LEARNING_RATE * (g[j] / x.length + L2 * b[j]);
    c -= LEARNING_RATE * (gc / x.length);
  }
  return { mean, sd, weights: b, bias: c };
}

const rawLogit = (model, features, r) =>
  features.reduce((a, f, j) => a + (model.weights[j] * (f(r) - model.mean[j])) / model.sd[j], model.bias);

function seededShuffle(items) {
  let state = 42;
  const next = () => (state = (state * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648;
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function crossValidate(rows, features) {
  const ids = seededShuffle([...new Set(rows.map((r) => r.id))]);
  const fold = new Map(ids.map((id, i) => [id, i % FOLDS]));
  const scores = new Map();
  for (let f = 0; f < FOLDS; f++) {
    const model = fit(
      rows.filter((r) => fold.get(r.id) !== f),
      features,
    );
    for (const r of rows) if (fold.get(r.id) === f) scores.set(r, rawLogit(model, features, r));
  }
  return scores;
}

const bucketOf = (tokens) =>
  BUCKETS.reduce((best, b) => (Math.abs(b - tokens) < Math.abs(best - tokens) ? b : best));
const pct = (hits, rows) => (rows.length ? `${Math.round((100 * hits) / rows.length)} %` : '-');
const rate = (rows, isFlagged) => pct(rows.filter(isFlagged).length, rows);

// seuil de la tranche placé pour ne signaler à tort que 5 % de ses textes humains, comme l'application
function thresholdAt5(inBucket, scores) {
  const human = inBucket
    .filter((r) => r.label === 'humain')
    .map((r) => scores.get(r))
    .sort((a, b) => a - b);
  return human.length ? human[Math.min(human.length - 1, Math.floor(0.95 * human.length))] : Infinity;
}

function flaggedAt5(rows, scores) {
  const thresholds = new Map(
    BUCKETS.map((b) => [b, thresholdAt5(rows.filter((r) => bucketOf(r.tokens) === b), scores)]),
  );
  return (r) => scores.get(r) > thresholds.get(bucketOf(r.tokens));
}

const rows = JSON.parse(await readFile(MEASURES, 'utf8')).filter((r) => r.tokens >= CALIBRATION.minTokens);
const texts = (label) => new Set(rows.filter((r) => r.label === label).map((r) => r.id)).size;
console.log(`${rows.length} mesures : ${texts('ia')} textes IA, ${texts('humain')} textes humains\n`);

// la calibration actuelle applique déjà ses propres seuils : logit > 0 signifie « signalé »
const results = {
  'actuelle (non réentraînée)': new Map(
    rows.map((r) => [r, logitWith(DEFAULT_CALIBRATION, r)]),
  ),
};
for (const [name, features] of Object.entries(FEATURE_SETS)) results[name] = crossValidate(rows, features);

for (const [name, scores] of Object.entries(results)) {
  const flagged = name.startsWith('actuelle') ? (r) => scores.get(r) > 0 : flaggedAt5(rows, scores);
  console.log(`== ${name}`);
  console.table(
    BUCKETS.map((b) => {
      const inBucket = rows.filter((r) => bucketOf(r.tokens) === b);
      return {
        tokens: b,
        'IA repérés': rate(
          inBucket.filter((r) => r.label === 'ia'),
          flagged,
        ),
        'humains signalés à tort': rate(
          inBucket.filter((r) => r.label === 'humain'),
          flagged,
        ),
      };
    }),
  );
  const long = rows.filter((r) => r.tokens >= 80);
  const byVendor = Object.fromEntries(
    [...new Set(long.filter((r) => r.label === 'ia').map((r) => r.vendor))].map((v) => [
      v,
      rate(
        long.filter((r) => r.vendor === v),
        flagged,
      ),
    ]),
  );
  const byGenre = Object.fromEntries(
    [...new Set(long.map((r) => r.genre))].map((g) => [
      g,
      rate(
        long.filter((r) => r.genre === g && r.label === 'humain'),
        flagged,
      ),
    ]),
  );
  console.log('80 tokens et plus, IA repérés par assistant :', byVendor);
  console.log('80 tokens et plus, humains signalés à tort par genre :', byGenre, '\n');
}

// coefficients entraînés sur tout le corpus, à reporter dans l'application si le gain est confirmé
const proposal = Object.fromEntries(
  Object.entries(FEATURE_SETS).map(([name, features]) => [name, fit(rows, features)]),
);
await writeFile(join(CORPUS_DIR, 'proposition.json'), JSON.stringify(proposal, null, 2));
console.log(`Coefficients proposés : ${join(CORPUS_DIR, 'proposition.json')}`);
