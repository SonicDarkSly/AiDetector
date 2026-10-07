#!/usr/bin/env node
// Exporte les mesures du corpus vers server/calibration-samples.json (mesures seules, jamais les textes)
// et réécrit DEFAULT_CALIBRATION dans calibration.ts, calculée par le code de l'application.
// Les mesures Binoculars (binoculars.mjs) sont jointes si elles existent.
// Usage : npm run build -w server && node scripts/corpus/export.mjs
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { CORPUS_DIR, MEASURES, ROOT } from './corpus-lib.mjs';

const require = createRequire(import.meta.url);
const { CALIBRATION } = require(join(ROOT, 'server/dist/detection/domain/likelihood/calibration.js'));
const { calibrate } = require(join(ROOT, 'server/dist/detection/domain/likelihood/recalibration.js'));
const CALIBRATION_TS = join(ROOT, 'server/src/detection/domain/likelihood/calibration.ts');
const BINOCULARS = join(CORPUS_DIR, 'binoculars.json');

const measures = JSON.parse(await readFile(MEASURES, 'utf8')).filter(
  (r) => r.tokens >= CALIBRATION.minTokens,
);
// même texte, même longueur mesurée (à un token près : positions ignorées différentes)
const binoculars = existsSync(BINOCULARS)
  ? Map.groupBy(JSON.parse(await readFile(BINOCULARS, 'utf8')), (b) => b.id)
  : new Map();
const binocularsOf = (r) =>
  binoculars.get(r.id)?.find((b) => Math.abs(b.tokens - r.tokens) <= 2)?.binoculars ?? null;

const ids = [...new Set(measures.map((r) => r.id))];
const group = new Map(ids.map((id, i) => [id, i]));
const rows = measures.map((r) => [
  group.get(r.id),
  r.label === 'ia' ? 1 : 0,
  r.tokens,
  r.meanLogProb,
  r.meanEntropy,
  r.criterion,
  binocularsOf(r),
]);
await writeFile(
  join(ROOT, 'server/calibration-samples.json'),
  JSON.stringify({
    columns: ['text', 'ai', 'tokens', 'meanLogProb', 'meanEntropy', 'criterion', 'binoculars'],
    rows,
  }),
);

const samples = rows.map(([g, ai, tokens, meanLogProb, meanEntropy, criterion, bino]) => ({
  group: g,
  ai: ai === 1,
  tokens,
  meanLogProb,
  meanEntropy,
  criterion,
  binoculars: bino ?? undefined,
  weight: 1,
}));
const result = calibrate(samples);
const count = (label) => new Set(measures.filter((r) => r.label === label).map((r) => r.id)).size;
const round = (x) => Math.round(x * 10_000) / 10_000;
const formula = (f) =>
  f && {
    features: Object.fromEntries(
      Object.entries(f.features).map(([k, v]) => [
        k,
        { mean: round(v.mean), sd: round(v.sd), weight: round(v.weight) },
      ]),
    ),
    bias: round(f.bias),
    thresholds: f.thresholds.map((t) => ({ tokens: t.tokens, offset: round(t.offset) })),
    rates: f.rates,
  };
const calibration = {
  version: 3,
  measures: formula(result.measures),
  binoculars: formula(result.binoculars),
  origin: 'origine',
  texts: { ai: count('ia'), human: count('humain') },
  answers: 0,
  rates: result.rates,
  appliedAt: null,
};

// petits objets sans sous-objet sur une ligne, comme le reste du fichier (prettier les garde ainsi)
const compact = (json) =>
  json.replace(/\{\n\s+([^{}[\]]+?)\n\s+\}/g, (_, body) => `{ ${body.replace(/,\n\s+/g, ', ')} }`);

const source = await readFile(CALIBRATION_TS, 'utf8');
const start = source.indexOf('export const DEFAULT_CALIBRATION: Calibration = {');
const end = source.indexOf('\n};', start) + 3;
if (start < 0 || end < 3) throw new Error('DEFAULT_CALIBRATION introuvable dans calibration.ts');
await writeFile(
  CALIBRATION_TS,
  source.slice(0, start) +
    `export const DEFAULT_CALIBRATION: Calibration = ${compact(JSON.stringify(calibration, null, 2))};` +
    source.slice(end),
);

const withBinoculars = rows.filter((r) => r[6] !== null).length;
console.log(`${rows.length} mesures (${withBinoculars} avec Binoculars), ${ids.length} textes exportés`);
console.log('DEFAULT_CALIBRATION réécrite dans calibration.ts : lancer prettier puis reporter les taux');
console.log('(client/src/constants.ts, aide, README) :');
console.table(
  result.rates.map((r) => ({
    tokens: r.tokens,
    'IA repérés': `${Math.round(r.detected * 100)} %`,
    'humains signalés à tort': `${Math.round(r.falsePositives * 100)} %`,
  })),
);
