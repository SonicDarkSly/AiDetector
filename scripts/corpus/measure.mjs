#!/usr/bin/env node
// Mesure chaque texte du corpus avec le modèle local de l'application, à plusieurs longueurs.
// Reprend là où il s'était arrêté. Usage : npm run build -w server && node scripts/corpus/measure.mjs
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { CORPUS_DIR, MANIFEST, MEASURES, ROOT } from './corpus-lib.mjs';

const LENGTHS = [30, 50, 80, 120, 200, 250];

const require = createRequire(import.meta.url);
const { LlamaLikelihoodScorer } = require(
  join(ROOT, 'server/dist/detection/infrastructure/likelihood/llama-likelihood.scorer.js'),
);
const scorer = new LlamaLikelihoodScorer();

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const rows = existsSync(MEASURES) ? JSON.parse(await readFile(MEASURES, 'utf8')) : [];
const model = scorer.modelName();
const done = new Set(rows.filter((r) => r.model === model).map((r) => r.id));
const todo = manifest.filter((e) => !done.has(e.id));
console.log(`${model} : ${todo.length} texte(s) à mesurer, ${done.size} déjà faits`);

const started = Date.now();
for (const [i, entry] of todo.entries()) {
  const text = await readFile(join(CORPUS_DIR, entry.file), 'utf8');
  const measures = await scorer.measurePrefixes(text, LENGTHS);
  for (const m of measures) {
    rows.push({
      id: entry.id,
      label: entry.label,
      vendor: entry.vendor,
      genre: entry.genre,
      model: m.model,
      tokens: m.tokens,
      meanLogProb: +m.meanLogProb.toFixed(4),
      meanEntropy: +m.meanEntropy.toFixed(4),
      criterion: +m.criterion.toFixed(4),
    });
  }
  if (i % 10 === 9 || i === todo.length - 1) {
    await writeFile(MEASURES, JSON.stringify(rows));
    const eta = ((Date.now() - started) / (i + 1)) * (todo.length - i - 1);
    console.log(`${i + 1}/${todo.length} (reste environ ${Math.ceil(eta / 60000)} min)`);
  }
}
await scorer.onModuleDestroy();
console.log(`${rows.length} mesures dans ${MEASURES}`);
process.exit(0);
