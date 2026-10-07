#!/usr/bin/env node
// Consignes communes à tous les assistants : mêmes sujets et genres que les textes humains,
// longueurs et styles variés. Écrit consignes.json et consignes.md (lots à copier-coller).
// Usage : node scripts/corpus/consignes.mjs [par genre = 20]
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CORPUS_DIR, MANIFEST, PROMPTS } from './corpus-lib.mjs';

const perGenre = Number(process.argv[2] ?? 20);
const BATCH = 10;
const LENGTHS = [80, 150, 250, 350];
const STYLES = ['neutre', 'neutre', 'naturel', 'simple'];
const FILMS = [
  'Intouchables',
  "Le Fabuleux Destin d'Amélie Poulain",
  'Titanic',
  'Inception',
  'Le Dîner de cons',
  'La Haine',
  'Parasite',
  'Interstellar',
  'Les Visiteurs',
  "Bienvenue chez les Ch'tis",
  'The Dark Knight',
  'Matrix',
  'Forrest Gump',
  'Le Grand Bleu',
  'La La Land',
  'Joker',
  'Avatar',
  'Les Choristes',
  'Gladiator',
  'Le Roi lion',
  'Pulp Fiction',
  'Astérix et Obélix : Mission Cléopâtre',
  'Whiplash',
  'Le Prénom',
  'Mad Max: Fury Road',
  'Coco',
];
const MOODS = ['Tu as adoré le film.', 'Tu as été déçu par le film.', 'Ton avis est mitigé.'];

const STYLE_HINTS = {
  neutre: { default: '', avis: '' },
  naturel: {
    default:
      ' Écris de façon naturelle, comme le ferait une personne, en évitant les tournures typiques des IA.',
    avis: ' Écris de façon naturelle, comme le ferait une personne, en évitant les tournures typiques des IA.',
  },
  simple: {
    default: ' Utilise un style simple et direct.',
    avis: ' Écris dans un style familier, comme un internaute.',
  },
};
const ONLY_TEXT =
  " Réponds uniquement avec le texte, sans titre, sans mise en forme Markdown et sans phrase d'introduction ni de conclusion à mon intention.";

function seededShuffle(items, seed) {
  let state = seed;
  const next = () => (state = (state * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648;
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const titles = (genre) =>
  seededShuffle(
    manifest.filter((e) => e.label === 'humain' && e.genre === genre).map((e) => e.title),
    7,
  ).slice(0, perGenre);

const topics = [
  ...titles('wiki').map((topic) => ({ genre: 'wiki', topic })),
  ...titles('news').map((topic) => ({ genre: 'news', topic })),
  ...seededShuffle(FILMS, 11)
    .slice(0, perGenre)
    .map((topic) => ({ genre: 'avis', topic })),
];

const prompts = topics.map(({ genre, topic }, i) => {
  const words = LENGTHS[i % LENGTHS.length];
  const style = STYLES[Math.floor(i / LENGTHS.length) % STYLES.length];
  const hint = STYLE_HINTS[style][genre] ?? STYLE_HINTS[style].default;
  const ask = {
    wiki: `Rédige en français un texte encyclopédique dans le style de Wikipédia, d'environ ${words} mots, sur le sujet suivant : « ${topic} ».`,
    news: `Rédige en français un article de presse d'environ ${words} mots sur l'événement suivant : « ${topic} ».`,
    avis: `Écris en français une critique du film « ${topic} », comme un spectateur qui donne son avis sur Allociné, d'environ ${words} mots. ${MOODS[i % MOODS.length]}`,
  }[genre];
  return {
    id: `p${String(i + 1).padStart(2, '0')}`,
    genre,
    topic,
    words,
    style,
    prompt: ask + hint + ONLY_TEXT,
  };
});
await writeFile(PROMPTS, JSON.stringify(prompts, null, 1));

// version manuelle : un message par lot, réponses séparées par « ===== pNN »
const batches = [];
for (let i = 0; i < prompts.length; i += BATCH) batches.push(prompts.slice(i, i + BATCH));
const md = [
  '# Consignes du corpus MefIAnce',
  '',
  'Pour chaque assistant : une **nouvelle conversation par lot**, coller le message du lot, puis copier toute la réponse',
  "dans un fichier texte et l'importer avec `node scripts/corpus/import.mjs <assistant> <fichier>`.",
  '',
  ...batches.flatMap((batch, b) => [
    `## Lot ${b + 1} (${batch[0].id} à ${batch.at(-1).id})`,
    '',
    '```',
    `Voici ${batch.length} consignes indépendantes. Pour chacune, écris le texte demandé. Avant chaque texte, écris une ligne contenant uniquement « ===== » suivi du numéro de la consigne (par exemple « ===== ${batch[0].id} »).`,
    '',
    ...batch.map((p) => `${p.id}. ${p.prompt}`),
    '```',
    '',
  ]),
].join('\n');
await writeFile(join(CORPUS_DIR, 'consignes.md'), md);
console.log(`${prompts.length} consignes, ${batches.length} lots : ${PROMPTS} et consignes.md`);
