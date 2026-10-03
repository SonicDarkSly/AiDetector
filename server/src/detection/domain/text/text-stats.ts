export interface TextStats {
  chars: number;
  words: number;
  sentences: number;
  paragraphs: number;
  language: 'fr' | 'en' | 'autre';
  avgSentenceLength: number;
  sentenceLengthCv: number;
  lexicalDiversity: number;
  avgWordLength: number;
  emDashPer1000: number;
  bulletLineRatio: number;
}

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

const FR_STOP = new Set(
  'le la les des est et une un que pour dans qui pas du en sur au aux avec ce cette il elle nous vous ils sont être fait plus mais ou donc car ne se son sa ses leur'.split(
    ' ',
  ),
);
const EN_STOP = new Set(
  'the and is of to in that it for with as was on are this be by an at or from have has not but which you your their they will can'.split(
    ' ',
  ),
);

export function words(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

export function detectLanguage(ws: string[]): 'fr' | 'en' | 'autre' {
  let fr = 0;
  let en = 0;
  for (const w of ws.slice(0, 3000)) {
    const l = w.toLowerCase();
    if (FR_STOP.has(l)) fr++;
    if (EN_STOP.has(l)) en++;
  }
  const total = Math.max(1, Math.min(ws.length, 3000));
  if (fr / total < 0.06 && en / total < 0.06) return 'autre';
  return fr >= en ? 'fr' : 'en';
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => words(s).length >= 3);
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => words(p).length > 0);
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function coefficientOfVariation(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  if (m === 0) return 0;
  const variance = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance) / m;
}

function mattr(ws: string[], window = 50): number {
  const lower = ws.map((w) => w.toLowerCase());
  if (lower.length === 0) return 0;
  if (lower.length <= window) return new Set(lower).size / lower.length;
  const counts = new Map<string, number>();
  for (let i = 0; i < window; i++) counts.set(lower[i], (counts.get(lower[i]) ?? 0) + 1);
  let sum = counts.size / window;
  let n = 1;
  for (let i = window; i < lower.length; i++) {
    const out = lower[i - window];
    const c = (counts.get(out) ?? 1) - 1;
    if (c <= 0) counts.delete(out);
    else counts.set(out, c);
    counts.set(lower[i], (counts.get(lower[i]) ?? 0) + 1);
    sum += counts.size / window;
    n++;
  }
  return sum / n;
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export function computeStats(text: string): TextStats {
  const ws = words(text);
  const sents = sentences(text);
  const lens = sents.map((s) => words(s).length);
  const lines = text.split('\n').filter((l) => l.trim());
  const bullets = lines.filter((l) => /^\s*([-*•▪◦·‣]|\d{1,2}[.)])\s+/u.test(l)).length;
  const emDashes = (text.match(/\u2014/g) ?? []).length;
  return {
    chars: text.length,
    words: ws.length,
    sentences: sents.length,
    paragraphs: paragraphs(text).length,
    language: detectLanguage(ws),
    avgSentenceLength: round(mean(lens), 1),
    sentenceLengthCv: round(coefficientOfVariation(lens)),
    lexicalDiversity: round(mattr(ws)),
    avgWordLength: round(mean(ws.map((w) => w.length)), 1),
    emDashPer1000: ws.length ? round((emDashes * 1000) / ws.length, 1) : 0,
    bulletLineRatio: lines.length ? round(bullets / lines.length) : 0,
  };
}
