import type { DocKind, MetaEntry, SourceDocument } from '../../domain/document/source-document.js';
import type { UploadedFile } from '../../domain/document/document-reader.js';

export function decodeText(buffer: Buffer): { text: string; encoding: string; bom: boolean } {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.subarray(3).toString('utf8'), encoding: 'UTF-8', bom: true };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(buffer.subarray(2)), encoding: 'UTF-16 LE', bom: true };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(buffer.subarray(2)), encoding: 'UTF-16 BE', bom: true };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buffer), encoding: 'UTF-8', bom: false };
  } catch {
    return {
      text: new TextDecoder('windows-1252').decode(buffer),
      encoding: 'Windows-1252 / Latin-1',
      bom: false,
    };
  }
}

export function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 4096);
  if (sample.length === 0) return true;
  let ctrl = 0;
  for (const b of sample) if (b === 0 || b < 9 || (b > 13 && b < 32)) ctrl++;
  return ctrl / sample.length < 0.02;
}

export function readPlainText(file: UploadedFile, kind: DocKind, extension: string | null): SourceDocument {
  const { text: rawText, encoding, bom } = decodeText(file.buffer);
  const crlf = (rawText.match(/\r\n/g) ?? []).length;
  const lf = (rawText.match(/(?<!\r)\n/g) ?? []).length;
  const lineEndings =
    crlf && lf ? 'mixtes (CRLF + LF)' : crlf ? 'CRLF (Windows)' : lf ? 'LF (macOS / Linux)' : '-';
  const text = rawText.replace(/\r\n?/g, '\n');
  const metadata: MetaEntry[] = [
    { key: 'Encodage', value: encoding },
    { key: 'BOM', value: bom ? 'oui' : 'non' },
    { key: 'Fins de ligne', value: lineEndings },
    { key: 'Lignes', value: String(text.split('\n').length) },
  ];
  return {
    kind,
    filename: file.filename,
    mimetype: file.mimetype || null,
    size: file.buffer.length,
    text,
    metadata,
    raw: { 'file.encoding': encoding, 'file.lineendings': lineEndings },
    urls: [],
    extension,
  };
}
