#!/usr/bin/env node
// Exporte les mesures du corpus vers server/calibration-samples.json (mesures seules, jamais les textes)
// et affiche la calibration d'origine à reporter dans calibration.ts, calculée par le code de l'application.
// Usage : npm run build -w server && node scripts/corpus/export.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { MEASURES, ROOT } from './corpus-lib.mjs';

const require = createRequire(import.meta.url);
const { CALIBRATION } = require(join(ROOT, 'server/dist/detection/domain/likelihood/calibration.js'));
const { calibrate } = require(join(ROOT, 'server/dist/detection/domain/likelihood/recalibration.js'));

const measures = JSON.parse(await readFile(MEASURES, 'utf8')).filter(
  (r) => r.tokens >= CALIBRATION.minTokens,
);
const ids = [...new Set(measures.map((r) => r.id))];
const group = new Map(ids.map((id, i) => [id, i]));
const rows = measures.map((r) => [
  group.get(r.id),
  r.label === 'ia' ? 1 : 0,
  r.tokens,
  r.meanLogProb,
  r.meanEntropy,
  r.criterion,
]);
await writeFile(
  join(ROOT, 'server/calibration-samples.json'),
  JSON.stringify({ columns: ['text', 'ai', 'tokens', 'meanLogProb', 'meanEntropy', 'criterion'], rows }),
);

const samples = rows.map(([g, ai, tokens, meanLogProb, meanEntropy, criterion]) => ({
  group: g,
  ai: ai === 1,
  tokens,
  meanLogProb,
  meanEntropy,
  criterion,
  weight: 1,
}));
const { coefficients, rates } = calibrate(samples);
const count = (label) => new Set(measures.filter((r) => r.label === label).map((r) => r.id)).size;
const round = (x) => Math.round(x * 10_000) / 10_000;
const calibration = {
  version: 2,
  features: Object.fromEntries(
    Object.entries(coefficients.features).map(([k, f]) => [
      k,
      { mean: round(f.mean), sd: round(f.sd), weight: round(f.weight) },
    ]),
  ),
  bias: round(coefficients.bias),
  thresholds: coefficients.thresholds.map((t) => ({ tokens: t.tokens, offset: round(t.offset) })),
  origin: 'origine',
  texts: { ai: count('ia'), human: count('humain') },
  answers: 0,
  rates,
  appliedAt: null,
};
console.log(`${rows.length} mesures, ${ids.length} textes exportés dans server/calibration-samples.json\n`);
console.log('export const DEFAULT_CALIBRATION: Calibration = ' + JSON.stringify(calibration, null, 2) + ';');
