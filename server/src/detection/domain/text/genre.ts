export type TextDomain = 'prose' | 'technical' | 'verse';

const WORD = /\p{L}[\p{L}'’-]*/gu;
const LIST_MARKER = /^([-*•–—>]|\d+[.)])\s/u;

function ending(line: string): string {
  const words = line.toLowerCase().match(WORD);
  const last = words?.at(-1) ?? '';
  return last
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/(e?s|e|nt)$/u, '')
    .slice(-2);
}

// lignes courtes, majuscule en début de vers, rimes : le modèle n'a été calibré que sur de la prose
export function looksLikeVerse(text: string): boolean {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 6) return false;
  if (lines.filter((l) => LIST_MARKER.test(l)).length / lines.length > 0.3) return false;

  const counts = lines.map((l) => l.match(WORD)?.length ?? 0);
  const short = counts.filter((n) => n >= 2 && n <= 10).length / lines.length;
  if (short < 0.85 || Math.max(...counts) > 14) return false;

  const capitals = lines.filter((l) => /^[\p{Lu}«"]/u.test(l)).length / lines.length;
  const sentences = lines.filter((l) => /[.!?]$/.test(l)).length / lines.length;
  const ends = lines.map(ending);
  let rhymes = 0;
  for (let i = 0; i < ends.length; i++) {
    const e = ends[i];
    if (e.length === 2 && (e === ends[i + 1] || e === ends[i + 2] || e === ends[i - 1] || e === ends[i - 2]))
      rhymes++;
  }
  return rhymes / lines.length >= 0.4 || (capitals >= 0.85 && sentences < 0.5 && short >= 0.9);
}
