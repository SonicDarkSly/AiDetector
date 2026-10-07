#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'server', 'data', 'llm');
const models = JSON.parse(readFileSync(join(root, 'server', 'llm-models.json'), 'utf8'));
const uris = process.env.MEFIANCE_MODEL ? [process.env.MEFIANCE_MODEL] : models.likelihood;
// observateur Binoculars : facultatif, l'analyse se replie sur les trois mesures sans lui
const observers = process.env.MEFIANCE_MODEL ? [] : (models.binocularsObserver ?? []);

if (process.env.MEFIANCE_MODEL === 'off') process.exit(0);

const { resolveModelFile } = await import('node-llama-cpp');

async function firstAvailable(list) {
  for (const uri of list) {
    try {
      const started = Date.now();
      const path = await resolveModelFile(uri, { directory });
      console.log(`Modèle prêt : ${path} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
      return true;
    } catch (err) {
      console.log(`Indisponible : ${uri} (${err instanceof Error ? err.message : err})`);
    }
  }
  return false;
}

if (!(await firstAvailable(uris))) process.exit(1);
if (observers.length && !(await firstAvailable(observers))) {
  console.log('Observateur Binoculars indisponible : analyse sur les trois mesures seulement.');
}
process.exit(0);
