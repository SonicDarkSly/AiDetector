#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'server', 'data', 'llm');

if (process.env.MEFIANCE_MODEL === 'off') process.exit(0);

const catalog = JSON.parse(readFileSync(join(root, 'server', 'llm-models.json'), 'utf8'));
const lists = process.env.MEFIANCE_MODEL
  ? [{ uris: [process.env.MEFIANCE_MODEL], required: true }]
  : [
      { uris: catalog.likelihood, required: true },
      { uris: catalog.candidate ?? [], required: false },
    ];

const { resolveModelFile } = await import('node-llama-cpp');

async function fetchFirst(uris) {
  for (const uri of uris) {
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

let ok = true;
for (const { uris, required } of lists) {
  if (!(await fetchFirst(uris)) && required) ok = false;
}
process.exit(ok ? 0 : 1);
