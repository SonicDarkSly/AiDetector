import type { Highlight, Strength } from '../signal/signal.js';

export function visible(s: string): string {
  return s
    .replace(/\u200B/g, '⟦ZWSP⟧')
    .replace(/\u200C/g, '⟦ZWNJ⟧')
    .replace(/\u200D/g, '⟦ZWJ⟧')
    .replace(/\u2060/g, '⟦WJ⟧')
    .replace(/\uFEFF/g, '⟦BOM⟧')
    .replace(/\u202F/g, '⟦NNBSP⟧')
    .replace(/\u00AD/g, '⟦SHY⟧')
    .replace(/[\uE000-\uF8FF]/g, (c) => `⟦U+${c.charCodeAt(0).toString(16).toUpperCase()}⟧`)
    .replace(/\s+/g, ' ');
}

export function excerpt(text: string, start: number, end: number, radius = 40): string {
  const a = Math.max(0, start - radius);
  const b = Math.min(text.length, end + radius);
  return `${a > 0 ? '…' : ''}${visible(text.slice(a, b)).trim()}${b < text.length ? '…' : ''}`;
}

export interface ScanResult {
  count: number;

  distinct: Set<string>;
  evidence: string[];
  highlights: Highlight[];
}

export function scan(
  text: string,
  re: RegExp,
  signalId: string,
  level: Strength,
  maxEvidence = 5,
  useExcerpt = true,
): ScanResult {
  const res: ScanResult = { count: 0, distinct: new Set(), evidence: [], highlights: [] };
  if (!re.global) throw new Error(`regex non globale pour ${signalId}`);
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    res.count++;
    res.distinct.add(m[0].toLowerCase().replace(/\s+/g, ' ').trim());
    res.highlights.push({ start: m.index, end: m.index + m[0].length, signalId, level });
    if (res.evidence.length < maxEvidence) {
      res.evidence.push(useExcerpt ? excerpt(text, m.index, m.index + m[0].length) : visible(m[0]));
    }
  }
  return res;
}
