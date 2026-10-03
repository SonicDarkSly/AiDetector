import JSZip from 'jszip';
import mammoth from 'mammoth';
import type { MetaEntry, SourceDocument } from '../../domain/document/source-document.js';
import { UnreadableDocumentError, type UploadedFile } from '../../domain/document/document-reader.js';
import { decodeEntities, tag } from './xml.js';

function formatIso(d: string | undefined): string | undefined {
  if (!d) return undefined;
  const t = Date.parse(d);
  if (Number.isNaN(t)) return d;
  return `${new Date(t).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (${d})`;
}

export async function readDocx(file: UploadedFile): Promise<SourceDocument> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file.buffer);
  } catch {
    throw new UnreadableDocumentError(
      'Fichier .docx illisible (archive corrompue, ou ancien format .doc renommé).',
    );
  }
  const read = async (p: string) => (await zip.file(p)?.async('string')) ?? null;
  const [core, app, custom, settings, documentXml, rels] = await Promise.all([
    read('docProps/core.xml'),
    read('docProps/app.xml'),
    read('docProps/custom.xml'),
    read('word/settings.xml'),
    read('word/document.xml'),
    read('word/_rels/document.xml.rels'),
  ]);
  if (!documentXml)
    throw new UnreadableDocumentError("Ce fichier n'est pas un document Word (.docx) valide.");

  const { value } = await mammoth.extractRawText({ buffer: file.buffer });
  const text = value
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const settingsRsids = new Set(
    [...(settings ?? '').matchAll(/<w:rsid w:val="([0-9A-Fa-f]{8})"/g)].map((m) => m[1]),
  );
  const bodyRsids = new Set(
    [...documentXml.matchAll(/w:rsid(?:R|RPr|P|Del|RDefault)?="([0-9A-Fa-f]{8})"/g)].map((m) => m[1]),
  );
  const rsids = settingsRsids.size || bodyRsids.size;

  const customValues: string[] = [];
  for (const m of (custom ?? '').matchAll(/<property[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/property>/g)) {
    const v = m[2].replace(/<[^>]+>/g, '').trim();
    customValues.push(`${decodeEntities(m[1])} = ${decodeEntities(v)}`);
  }

  const urls = [...(rels ?? '').matchAll(/Target="(https?:[^"]+)"/g)].map((m) => decodeEntities(m[1]));
  for (const m of text.matchAll(/https?:\/\/[^\s)\]"'>]+/g)) urls.push(m[0]);

  const raw: Record<string, string> = {};
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== '') raw[k] = v;
  };
  set('docx.creator', tag(core, 'dc:creator'));
  set('docx.lastmodifiedby', tag(core, 'cp:lastModifiedBy'));
  set('docx.description', tag(core, 'dc:description'));
  set('docx.title', tag(core, 'dc:title'));
  set('docx.subject', tag(core, 'dc:subject'));
  set('docx.created', tag(core, 'dcterms:created'));
  set('docx.modified', tag(core, 'dcterms:modified'));
  set('docx.revision', tag(core, 'cp:revision'));
  raw['docx.hasapp'] = app ? '1' : '0';
  set('docx.application', tag(app, 'Application'));
  set('docx.appversion', tag(app, 'AppVersion'));
  set('docx.totaltime', tag(app, 'TotalTime'));
  set('docx.company', tag(app, 'Company'));
  set('docx.template', tag(app, 'Template'));
  set('docx.words', tag(app, 'Words'));
  raw['docx.rsids'] = String(rsids);
  if (customValues.length) raw['docx.custom'] = customValues.join(' ; ');

  const metadata: MetaEntry[] = [];
  const add = (key: string, v: string | undefined) => {
    if (v !== undefined && v !== '') metadata.push({ key, value: v });
  };
  add('Créateur (auteur)', raw['docx.creator']);
  add('Modifié par', raw['docx.lastmodifiedby']);
  add('Titre', raw['docx.title']);
  add('Sujet', raw['docx.subject']);
  add('Description', raw['docx.description']);
  add('Créé le', formatIso(raw['docx.created']));
  add('Modifié le', formatIso(raw['docx.modified']));
  add('Révision', raw['docx.revision']);
  add('Application', app ? (raw['docx.application'] ?? '(non renseignée)') : '(fiche application absente)');
  add('Version application', raw['docx.appversion']);
  add(
    "Temps total d'édition",
    raw['docx.totaltime'] !== undefined ? `${raw['docx.totaltime']} min` : undefined,
  );
  add('Mots (selon le logiciel)', raw['docx.words']);
  add('Société', raw['docx.company']);
  add('Modèle', raw['docx.template']);
  add("Sessions d'édition Word (rsid)", String(rsids));
  add('Propriétés personnalisées', customValues.join(' ; ') || undefined);
  add('Liens externes', urls.length ? String(urls.length) : undefined);

  return {
    kind: 'docx',
    filename: file.filename,
    mimetype: file.mimetype || null,
    size: file.buffer.length,
    text,
    metadata,
    raw,
    urls: urls.slice(0, 500),
    extension: 'docx',
  };
}
