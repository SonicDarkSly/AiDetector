import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CORPUS_DIR = join(ROOT, 'server', 'data', 'corpus');
export const MANIFEST = join(CORPUS_DIR, 'manifest.json');
export const PROMPTS = join(CORPUS_DIR, 'consignes.json');
export const MEASURES = join(CORPUS_DIR, 'mesures.json');

export const VENDORS = ['claude', 'chatgpt', 'gemini', 'mistral', 'deepseek', 'copilot'];

export function wordCount(text) {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function cleanProse(html) {
  return html
    .replace(/<sup[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, e) => ENTITIES[e] ?? m)
    .replace(/\[\d+\]|\[réf\. nécessaire\]/g, '')
    .replace(/[ \t ]+/g, ' ')
    .trim();
}
