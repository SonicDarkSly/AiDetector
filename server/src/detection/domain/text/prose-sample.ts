const MIN_WORDS_PER_LINE = 6;
const MIN_SAMPLE_WORDS = 60;
const PROSE_CHARS = /[\p{L}\s,.;:'’!?«»()\-–]/u;
const CODE_HINTS = /[{}<>=_\\|#$@`]|\/\/|=>|\(\)|\[\d|\.(?:ts|js|py|json|gguf)\b/;

function wordCount(line: string): number {
  return line.match(/\p{L}[\p{L}'’-]*/gu)?.length ?? 0;
}

function isProse(line: string): boolean {
  const trimmed = line.trim();
  const words = trimmed.match(/\p{L}[\p{L}'’-]*/gu) ?? [];
  if (words.length < MIN_WORDS_PER_LINE) return false;
  // titres espacés (« N O T E S »), lignes de sommaire ou de tableau numérotées
  if (words.join('').length / words.length < 3.2) return false;
  if (/^\d/.test(trimmed)) return false;
  if (words.filter((w) => w.length >= 4 && w === w.toLowerCase()).length < 3) return false;
  if (CODE_HINTS.test(trimmed)) return false;
  const chars = [...trimmed];
  const prose = chars.filter((c) => PROSE_CHARS.test(c)).length;
  const digits = chars.filter((c) => /\d/.test(c)).length;
  return prose / chars.length >= 0.9 && digits / chars.length <= 0.08;
}

/**
 * Le modèle a été calibré sur de la prose. Dans un document, la page de garde, le sommaire, les
 * tableaux et le code faussent la mesure : on ne lui donne que les lignes rédigées.
 */
export function proseRatio(text: string): number {
  const sample = proseSample(text);
  return sample === text ? 0 : sample.length / Math.max(1, text.length);
}

export function proseSample(text: string): string {
  const kept: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length) kept.push(run.join(' '));
    run = [];
  };
  for (const line of text.split('\n')) {
    if (isProse(line)) run.push(line.trim());
    else flush();
  }
  flush();
  const sample = kept.join('\n\n');
  return wordCount(sample) >= MIN_SAMPLE_WORDS ? sample : text;
}
