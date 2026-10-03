#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'server', 'data', 'llm');
const uris = process.env.MEFIANCE_MODEL
  ? [process.env.MEFIANCE_MODEL]
  : JSON.parse(readFileSync(join(root, 'server', 'llm-models.json'), 'utf8')).likelihood;

if (process.env.MEFIANCE_MODEL === 'off') process.exit(0);

const { resolveModelFile } = await import('node-llama-cpp');
for (const uri of uris) {
  try {
    const started = Date.now();
    const path = await resolveModelFile(uri, { directory });
    console.log(`Modèle prêt : ${path} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
    process.exit(0);
  } catch (err) {
    console.log(`Indisponible : ${uri} (${err instanceof Error ? err.message : err})`);
  }
}
process.exit(1);
