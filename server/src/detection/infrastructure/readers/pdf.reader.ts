import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import type { MetaEntry, SourceDocument } from '../../domain/document/source-document.js';
import { UnreadableDocumentError, type UploadedFile } from '../../domain/document/document-reader.js';
import { attr, tag } from './xml.js';

function decodePdfLiteral(s: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') {
      bytes.push(s.charCodeAt(i) & 0xff);
      continue;
    }
    const n = s[++i];
    if (n === undefined) break;
    if (/[0-7]/.test(n)) {
      let oct = n;
      while (oct.length < 3 && /[0-7]/.test(s[i + 1] ?? '')) oct += s[++i];
      bytes.push(parseInt(oct, 8) & 0xff);
    } else {
      const map: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };
      if (n === '\r' || n === '\n') continue;
      bytes.push(map[n] ?? n.charCodeAt(0));
    }
  }
  return decodeBytes(Buffer.from(bytes));
}

function decodeBytes(b: Buffer): string {
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff)
    return new TextDecoder('utf-16be').decode(b.subarray(2));
  return b.toString('latin1');
}

function rawInfo(latin1: string, key: string): string | undefined {
  const lit = latin1.match(new RegExp(`/${key}\\s*\\(((?:[^()\\\\]|\\\\.|\\((?:[^()\\\\]|\\\\.)*\\))*)\\)`));
  if (lit) return decodePdfLiteral(lit[1]).trim() || undefined;
  const hex = latin1.match(new RegExp(`/${key}\\s*<([0-9A-Fa-f\\s]+)>`));
  if (hex) return decodeBytes(Buffer.from(hex[1].replace(/\s/g, ''), 'hex')).trim() || undefined;
  return undefined;
}

export function formatPdfDate(d: string | undefined): string | undefined {
  if (!d) return undefined;
  const m = d.match(/D?:?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz]|[+-]\d{2}'?\d{2}'?)?/);
  if (!m) return d;
  const [, y, mo = '01', da = '01', h = '00', mi = '00', s = '00', tz] = m;
  const zone = !tz
    ? 'fuseau non précisé'
    : /z/i.test(tz)
      ? 'UTC'
      : `UTC${tz.replace(/'/g, '').replace(/(\d{2})(\d{2})$/, '$1:$2')}`;
  return `${da}/${mo}/${y} ${h}:${mi}:${s} (${zone})`;
}

export async function readPdf(file: UploadedFile): Promise<SourceDocument> {
  const latin1 = file.buffer.toString('latin1');
  let text = '';
  let info: Record<string, unknown> = {};
  let pages: number | undefined;
  let parseError: string | undefined;
  try {
    const data = await pdfParse(file.buffer);
    text = data.text ?? '';
    info = (data.info ?? {}) as Record<string, unknown>;
    pages = data.numpages;
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
  }
  if (!text.trim() && parseError) {
    throw new UnreadableDocumentError(`PDF illisible (${parseError}). Fichier chiffré ou endommagé ?`);
  }
  text = text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const str = (k: string): string | undefined => {
    const v = info[k];
    const s = typeof v === 'string' ? v.trim() : undefined;
    return s || rawInfo(latin1, k);
  };

  const xs = latin1.indexOf('<x:xmpmeta');
  const xe = xs >= 0 ? latin1.indexOf('</x:xmpmeta>', xs) : -1;
  const xmp = xs >= 0 && xe > xs ? file.buffer.subarray(xs, xe + 12).toString('utf8') : null;
  const xmpGet = (name: string) => tag(xmp, name) ?? attr(xmp, name);
  const digitalSource =
    xmpGet('Iptc4xmpExt:DigitalSourceType') ??
    xmpGet('DigitalSourceType') ??
    xmp?.match(
      /(trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia|compositeSynthetic)/i,
    )?.[1];

  const hasC2pa = /c2pa/i.test(latin1) && /jumb|c2pa\.claim|urn:c2pa|c2pa\.manifest/i.test(latin1);
  const generator = hasC2pa
    ? latin1
        .match(
          /claim_generator(?:_info)?[^\x20-\x7e]{0,12}(?:[^\x20-\x7e]*name[^\x20-\x7e]{0,4})?([\x20-\x7e]{3,100})/,
        )?.[1]
        ?.replace(/^[^A-Za-z0-9]+/, '')
        .trim()
    : undefined;

  const urls = new Set<string>();
  for (const m of latin1.matchAll(/\/URI\s*\(((?:[^()\\]|\\.){4,800})\)/g)) urls.add(decodePdfLiteral(m[1]));
  for (const m of text.matchAll(/https?:\/\/[^\s)\]"'>]+/g)) urls.add(m[0]);

  const raw: Record<string, string> = {};
  const set = (k: string, v: string | undefined) => {
    if (v) raw[k] = v;
  };
  set('pdf.producer', str('Producer'));
  set('pdf.creator', str('Creator'));
  set('pdf.author', str('Author'));
  set('pdf.title', str('Title'));
  set('pdf.subject', str('Subject'));
  set('pdf.keywords', str('Keywords'));
  set('pdf.creationdate', str('CreationDate'));
  set('pdf.moddate', str('ModDate'));
  if (/ReportLab Generated PDF document/i.test(latin1.slice(0, 2000))) raw['pdf.reportlab'] = '1';
  set('xmp.creatortool', xmpGet('xmp:CreatorTool'));
  set('xmp.producer', xmpGet('pdf:Producer'));
  set('xmp.digitalsourcetype', digitalSource);
  if (hasC2pa) raw['c2pa'] = '1';
  set('c2pa.generator', generator);

  const metadata: MetaEntry[] = [];
  const add = (key: string, value: string | undefined) => {
    if (value) metadata.push({ key, value });
  };
  add('Producteur (Producer)', raw['pdf.producer']);
  add('Créateur (Creator)', raw['pdf.creator']);
  add('Auteur', raw['pdf.author']);
  add('Titre', raw['pdf.title']);
  add('Sujet', raw['pdf.subject']);
  add('Mots-clés', raw['pdf.keywords']);
  add('Créé le', formatPdfDate(raw['pdf.creationdate']));
  add('Modifié le', formatPdfDate(raw['pdf.moddate']));
  add('XMP · Outil créateur', raw['xmp.creatortool']);
  add('XMP · Producteur', raw['xmp.producer']);
  add('XMP · Source numérique (IPTC)', raw['xmp.digitalsourcetype']);
  add('XMP · Créé le', xmpGet('xmp:CreateDate'));
  add('C2PA (Content Credentials)', hasC2pa ? `présent${generator ? ` (${generator})` : ''}` : undefined);
  add('Pages', pages ? String(pages) : undefined);
  add('Version PDF', latin1.match(/^%PDF-(\d\.\d)/)?.[1]);
  add('Liens trouvés', urls.size ? String(urls.size) : undefined);
  if (raw['pdf.reportlab']) add('En-tête du fichier', '« ReportLab Generated PDF document »');
  if (parseError) add('Avertissement', `lecture partielle (${parseError})`);

  return {
    kind: 'pdf',
    filename: file.filename,
    mimetype: file.mimetype || null,
    size: file.buffer.length,
    text,
    metadata,
    raw,
    urls: [...urls].slice(0, 500),
    extension: 'pdf',
  };
}
