#!/usr/bin/env node
// Collecte de textes humains en français, tous publiés avant 2022 :
// Wikipédia (version de l'article au 31/12/2021), Wikinews (articles d'avant 2022), critiques Allociné.
// Usage : node scripts/corpus/fetch-human.mjs [wiki=150] [news=100] [avis=150]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { CORPUS_DIR, MANIFEST, cleanProse, wordCount } from './corpus-lib.mjs';

const [wikiTarget = 150, newsTarget = 100, avisTarget = 150] = process.argv.slice(2).map(Number);
const CUTOFF = '2021-12-31T23:59:59Z';
const UA = 'MefIAnce-corpus/1.0 (script de recherche local, faible volume)';
const MIN_WORDS = 80;
const MAX_WORDS = 400;
// paragraphes ajoutés par des robots de Wikipédia (communes françaises) : pas de l'écriture humaine
const BOT_TEXT = /grille communale de densité|aire d'attraction d|unité urbaine|Corine Land Cover/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(host, params) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    // les API Wikimedia limitent les clients anonymes : une requête par seconde au plus
    await sleep(1000);
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    const retry = Number(res.headers.get('retry-after'));
    await sleep((retry > 0 ? retry : 15 * (attempt + 1)) * 1000);
  }
  throw new Error(`${host} : échec de ${params.action}`);
}

// paragraphes de prose d'une révision, sans tableaux, infobox ni références
async function revisionProse(host, title) {
  const rev = await api(host, {
    action: 'query',
    prop: 'revisions',
    titles: title,
    rvlimit: '1',
    rvstart: CUTOFF,
    rvdir: 'older',
    rvprop: 'ids|timestamp',
  });
  const r = rev.query?.pages?.[0]?.revisions?.[0];
  if (!r) return null;
  const parsed = await api(host, {
    action: 'parse',
    oldid: String(r.revid),
    prop: 'text',
    disablelimitreport: '1',
  });
  const html = parsed.parse?.text ?? '';
  const paragraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((m) => cleanProse(m[1]))
    .filter((p) => wordCount(p) >= 15 && !/^(Coordonnées|Pour les articles homonymes|Publié le )/.test(p));
  let text = '';
  for (const p of paragraphs) {
    if (wordCount(text) >= MAX_WORDS * 0.75) break;
    text += (text ? '\n\n' : '') + p;
  }
  return { text, revid: r.revid, date: r.timestamp };
}

async function collectWiki(manifest, target) {
  let got = manifest.filter((e) => e.genre === 'wiki').length;
  const seen = new Set(manifest.map((e) => e.title));
  while (got < target) {
    // taille de la page actuelle : écarte d'emblée les ébauches, trop courtes pour une mesure
    const random = await api('fr.wikipedia.org', {
      action: 'query',
      generator: 'random',
      grnnamespace: '0',
      grnlimit: '20',
      prop: 'info',
    });
    for (const { title, length } of random.query.pages) {
      if (got >= target || seen.has(title) || length < 6000 || /^Liste |\(homonymie\)/.test(title)) continue;
      seen.add(title);
      const prose = await revisionProse('fr.wikipedia.org', title).catch(() => null);
      if (!prose || wordCount(prose.text) < MIN_WORDS || BOT_TEXT.test(prose.text)) continue;
      await save(manifest, 'wiki', prose.text, {
        title,
        source: `https://fr.wikipedia.org/w/index.php?oldid=${prose.revid}`,
        date: prose.date,
      });
      got++;
    }
  }
}

const MONTHS = 'Janvier Février Mars Avril Mai Juin Juillet Août Septembre Octobre Novembre Décembre'.split(
  ' ',
);

async function collectNews(manifest, target) {
  let got = manifest.filter((e) => e.genre === 'news').length;
  const seen = new Set(manifest.map((e) => e.title));
  // catégories mensuelles de 2008 à 2021, dans le désordre, quelques articles par mois pour varier les sujets
  const months = MONTHS.flatMap((m) =>
    Array.from({ length: 14 }, (_, i) => `Catégorie:${m} ${2008 + i}`),
  ).sort(() => Math.random() - 0.5);
  for (const cmtitle of months) {
    if (got >= target) break;
    const list = await api('fr.wikinews.org', {
      action: 'query',
      list: 'categorymembers',
      cmtitle,
      cmnamespace: '0',
      cmlimit: '50',
    });
    const pages = (list.query?.categorymembers ?? []).sort(() => Math.random() - 0.5);
    let taken = 0;
    for (const { title } of pages) {
      if (got >= target || taken >= 3) break;
      if (seen.has(title)) continue;
      seen.add(title);
      const prose = await revisionProse('fr.wikinews.org', title).catch(() => null);
      if (!prose || wordCount(prose.text) < MIN_WORDS) continue;
      await save(manifest, 'news', prose.text, {
        title,
        source: `https://fr.wikinews.org/w/index.php?oldid=${prose.revid}`,
        date: prose.date,
      });
      got++;
      taken++;
    }
  }
}

async function collectReviews(manifest, target) {
  let got = manifest.filter((e) => e.genre === 'avis').length;
  // pages tirées au hasard dans les 20 000 critiques de test (publiées avant 2020)
  const offsets = Array.from({ length: 200 }, (_, i) => i * 100).sort(() => Math.random() - 0.5);
  for (const offset of offsets) {
    if (got >= target) break;
    const url = `https://datasets-server.huggingface.co/rows?dataset=tblard/allocine&config=allocine&split=test&offset=${offset}&length=100`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) continue;
    const { rows } = await res.json();
    for (const { row_idx, row } of rows) {
      if (got >= target) break;
      const text = row.review.trim();
      // une seule par page pour varier les auteurs, et assez longue pour une mesure
      if (wordCount(text) < MIN_WORDS / 2 || wordCount(text) > MAX_WORDS) continue;
      await save(manifest, 'avis', text, {
        title: `Allociné #${row_idx}`,
        source: 'https://huggingface.co/datasets/tblard/allocine',
        date: 'avant 2020',
      });
      got++;
      break;
    }
  }
}

async function save(manifest, genre, text, meta) {
  const id = `humain-${genre}-${String(manifest.filter((e) => e.genre === genre && e.label === 'humain').length + 1).padStart(3, '0')}`;
  const file = `humain/${genre}/${id}.txt`;
  await mkdir(`${CORPUS_DIR}/humain/${genre}`, { recursive: true });
  await writeFile(`${CORPUS_DIR}/${file}`, text);
  manifest.push({ id, label: 'humain', vendor: null, genre, file, words: wordCount(text), ...meta });
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 1));
  process.stdout.write(
    `\r${genre} ${manifest.filter((e) => e.genre === genre && e.label === 'humain').length}   `,
  );
}

await mkdir(CORPUS_DIR, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : [];
await collectWiki(manifest, wikiTarget);
await collectNews(manifest, newsTarget);
await collectReviews(manifest, avisTarget);
const human = manifest.filter((e) => e.label === 'humain');
console.log(`\n${human.length} textes humains dans ${CORPUS_DIR}`);
