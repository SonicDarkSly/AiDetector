#!/usr/bin/env node
// Mesure expérimentale Binoculars (Hans et al., 2024) sur le corpus, sans toucher à l'application.
// Observateur : Qwen2.5 3B de base ; exécutant : Qwen2.5 3B Instruct (même vocabulaire).
//   log-perplexité  = moyenne de -log p_exécutant(token écrit)
//   perplexité croisée = moyenne de -Σ_v p_observateur(v) · log p_exécutant(v)   (top-K de l'observateur)
//   score = log-perplexité / perplexité croisée : bas = IA
// Télécharge le modèle de base au premier lancement (environ 2 Go). Reprend là où il s'était arrêté.
// Usage : node scripts/corpus/binoculars.mjs
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getLlama, resolveModelFile } from 'node-llama-cpp';
import { CORPUS_DIR, MANIFEST, ROOT } from './corpus-lib.mjs';

const LLM_DIR = join(ROOT, 'server', 'data', 'llm');
const OBSERVER = 'hf:bartowski/Qwen2.5-3B-GGUF:Q4_K_M';
const PERFORMER = 'hf:bartowski/Qwen2.5-3B-Instruct-GGUF:Q4_K_M';
const OUTPUT = join(CORPUS_DIR, 'binoculars.json');
const LENGTHS = [30, 50, 80, 120, 200, 250];
const MAX_TOKENS = 250;
const TOP_K = 256;

const llama = await getLlama();
const load = async (uri) =>
  llama.loadModel({ modelPath: await resolveModelFile(uri, { directory: LLM_DIR, download: 'auto' }) });
const observer = await load(OBSERVER);
const performer = await load(PERFORMER);

// les deux modèles doivent découper le texte de la même façon
const probe = 'Le barrage de Bergerac est un ouvrage hydraulique construit sur la Dordogne.';
if (observer.tokenize(probe).join() !== performer.tokenize(probe).join()) {
  throw new Error('Vocabulaires différents : Binoculars exige le même découpage pour les deux modèles');
}

const greedy = { temperature: 1, topK: 0, topP: 1, minP: 0 };

async function evaluate(model, tokens, filterFor) {
  const context = await model.createContext({ contextSize: 512 });
  try {
    const input = tokens.map((token, i) =>
      i < tokens.length - 1
        ? [
            token,
            { generateNext: { logits: { filter: filterFor(i) }, totalLogitWeight: true, options: greedy } },
          ]
        : token,
    );
    return await context.getSequence().controlledEvaluate(input);
  } finally {
    await context.dispose();
  }
}

// log Z = logit max + log Σ exp(logit - max) ; la Map est triée du plus grand logit au plus petit
const logNormalizer = (next) => next.logits.values().next().value + Math.log(next.totalLogitWeight);

async function measure(text) {
  const tokens = performer.tokenize(text).slice(0, MAX_TOKENS);
  if (tokens.length < 8) return [];

  const observed = await evaluate(observer, tokens, (i) => ({ tokens: [tokens[i + 1]], includeTop: TOP_K }));
  const tops = observed.map((o) => (o?.next?.logits ? [...o.next.logits.keys()].slice(0, TOP_K) : []));
  const performed = await evaluate(performer, tokens, (i) => ({
    tokens: [tokens[i + 1], ...tops[i]],
    includeMax: true,
  }));

  const positions = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const o = observed[i]?.next;
    const p = performed[i]?.next;
    if (!o?.logits || !p?.logits) continue;
    const logZo = logNormalizer(o);
    const logZp = logNormalizer(p);
    const actual = p.logits.get(tokens[i + 1]);
    if (actual === undefined) continue;
    // distribution de l'observateur renormalisée sur son top-K
    let mass = 0;
    let cross = 0;
    for (const token of tops[i]) {
      const po = Math.exp(o.logits.get(token) - logZo);
      const lp = p.logits.get(token);
      if (lp === undefined) continue;
      mass += po;
      cross -= po * (lp - logZp);
    }
    if (mass <= 0) continue;
    positions.push({ at: i, logPpl: -(actual - logZp), xPpl: cross / mass, mass });
  }

  const out = [];
  for (const length of [...new Set(LENGTHS.map((l) => Math.min(l, tokens.length)))]) {
    const kept = positions.filter((p) => p.at < length - 1);
    if (!kept.length) continue;
    const mean = (k) => kept.reduce((a, p) => a + p[k], 0) / kept.length;
    out.push({
      tokens: kept.length + 1,
      logPpl: +mean('logPpl').toFixed(4),
      xPpl: +mean('xPpl').toFixed(4),
      binoculars: +(mean('logPpl') / mean('xPpl')).toFixed(4),
      topMass: +mean('mass').toFixed(4),
    });
  }
  return out;
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const rows = existsSync(OUTPUT) ? JSON.parse(await readFile(OUTPUT, 'utf8')) : [];
const done = new Set(rows.map((r) => r.id));
const todo = manifest.filter((e) => !done.has(e.id));
console.log(`Binoculars : ${todo.length} texte(s) à mesurer, ${done.size} déjà faits`);

const started = Date.now();
for (const [i, entry] of todo.entries()) {
  const text = await readFile(join(CORPUS_DIR, entry.file), 'utf8');
  for (const m of await measure(text)) {
    rows.push({ id: entry.id, label: entry.label, vendor: entry.vendor, genre: entry.genre, ...m });
  }
  if ((i + 1) % 10 === 0 || i === todo.length - 1) {
    await writeFile(OUTPUT, JSON.stringify(rows));
    const left = ((Date.now() - started) / (i + 1)) * (todo.length - i - 1);
    console.log(`${i + 1}/${todo.length} (reste environ ${Math.round(left / 60000)} min)`);
  }
}
await observer.dispose();
await performer.dispose();
console.log(`${rows.length} mesures dans ${OUTPUT}`);
