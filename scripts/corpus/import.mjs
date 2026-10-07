#!/usr/bin/env node
// Importe la réponse d'un assistant à un lot de consignes (textes séparés par « ===== pNN »).
// Usage : node scripts/corpus/import.mjs <assistant> <fichier>   ex. : import.mjs chatgpt lot1.txt
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CORPUS_DIR, MANIFEST, PROMPTS, VENDORS, wordCount } from './corpus-lib.mjs';

const [vendor, file] = process.argv.slice(2);
if (!VENDORS.includes(vendor) || !file) {
  console.error(`Usage : import.mjs <${VENDORS.join('|')}> <fichier>`);
  process.exit(1);
}
const prompts = new Map(JSON.parse(await readFile(PROMPTS, 'utf8')).map((p) => [p.id, p]));
const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : [];
// les assistants entourent parfois la réponse d'un bloc de code ou mettent les repères en gras
const raw = (await readFile(file, 'utf8')).replace(/\r\n?/g, '\n').replace(/^```.*$/gm, '');

let added = 0;
for (const part of raw.split(/^\s*(?:#+\s*)?(?:\*\*)?\s*=====\s*/m).slice(1)) {
  const header = part.match(/^(p\d+)(?:[ \t]*\*\*)?/);
  const id = header?.[1];
  const prompt = id && prompts.get(id);
  // retire le Markdown éventuel (titres, gras) : on ne garde que la prose
  const text = part
    .slice(header?.[0].length ?? 0)
    .replace(/^#+ .*$/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .trim();
  if (!prompt || wordCount(text) < 20) {
    console.warn(`ignoré : ${id ?? part.slice(0, 30)}`);
    continue;
  }
  const entryId = `${vendor}-${id}`;
  const path = `${vendor}/${id}.txt`;
  await mkdir(join(CORPUS_DIR, vendor), { recursive: true });
  await writeFile(join(CORPUS_DIR, path), text);
  const entry = {
    id: entryId,
    label: 'ia',
    vendor,
    genre: prompt.genre,
    file: path,
    words: wordCount(text),
    title: prompt.topic,
    style: prompt.style,
  };
  const at = manifest.findIndex((e) => e.id === entryId);
  if (at >= 0) manifest[at] = entry;
  else manifest.push(entry);
  added++;
}
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1));
console.log(`${added} texte(s) ${vendor} importé(s)`);
