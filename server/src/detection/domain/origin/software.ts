export interface SoftwareHint {
  name: string;
  confidence: number;
  source: string;
  aiNote?: string;
}

const KNOWN: [RegExp, string, string?][] = [
  [/reportlab/i, 'ReportLab', 'Bibliothèque Python utilisée par ChatGPT et Claude pour créer des PDF'],
  [/matplotlib/i, 'Matplotlib', 'Graphiques Python, utilisés par ChatGPT et Claude en mode analyse'],
  [/python-docx/i, 'python-docx', 'Bibliothèque Python utilisée par ChatGPT pour créer des .docx'],
  [/^un-named$/i, 'docx (JavaScript)', 'Bibliothèque utilisée par Claude pour créer des .docx'],
  [/weasyprint/i, 'WeasyPrint'],
  [/wkhtmltopdf/i, 'wkhtmltopdf'],
  [/xhtml2pdf|\bpisa\b/i, 'xhtml2pdf'],
  [/fpdf/i, 'FPDF'],
  [/pdfkit/i, 'PDFKit'],
  [/jspdf/i, 'jsPDF'],
  [/pdf-lib/i, 'pdf-lib'],
  [/pdfmake/i, 'pdfmake'],
  [/puppeteer/i, 'Puppeteer'],
  [/playwright/i, 'Playwright'],
  [/headlesschrome/i, 'Chrome / Edge (impression PDF)'],
  [/prince/i, 'Prince'],
  [/pandoc/i, 'Pandoc'],
  [/typst/i, 'Typst'],
  [/pikepdf/i, 'pikepdf'],
  [/pymupdf|\bfitz\b/i, 'PyMuPDF'],
  [/pypdf/i, 'pypdf'],
  [/qpdf/i, 'qpdf'],
  [/ghostscript/i, 'Ghostscript'],
  [/aspose/i, 'Aspose'],
  [/docx4j/i, 'docx4j'],
  [/phpword/i, 'PHPWord'],
  [/google docs/i, 'Google Docs'],
  [
    /microsoft.{0,4}word|word for (?:office|microsoft)|microsoft office word|microsoft macintosh word/i,
    'Microsoft Word',
  ],
  [/microsoft.{0,4}excel/i, 'Microsoft Excel'],
  [/microsoft.{0,4}powerpoint/i, 'Microsoft PowerPoint'],
  [/print to pdf/i, 'Microsoft Print to PDF'],
  [/acrobat pdfmaker/i, 'Adobe PDFMaker'],
  [/acrobat distiller/i, 'Adobe Distiller'],
  [/indesign/i, 'Adobe InDesign'],
  [/illustrator/i, 'Adobe Illustrator'],
  [/photoshop/i, 'Adobe Photoshop'],
  [/adobe acrobat/i, 'Adobe Acrobat'],
  [/canva/i, 'Canva'],
  [/\bpages\b/i, 'Apple Pages'],
  [/keynote/i, 'Apple Keynote'],
  [/libreoffice/i, 'LibreOffice'],
  [/openoffice/i, 'OpenOffice'],
  [/onlyoffice/i, 'OnlyOffice'],
  [/\bwps office\b|kingsoft/i, 'WPS Office'],
  [/skia\/pdf/i, 'Chrome / Edge (impression PDF)'],
  [/safari/i, 'Safari (impression PDF)'],
  [/firefox/i, 'Firefox (impression PDF)'],
  [/cairo/i, 'Cairo (bibliothèque graphique)'],
  [/quartz pdfcontext/i, 'macOS (impression PDF)'],
  [/pdftex|xetex|luatex|latex/i, 'LaTeX'],
];

const PLACEHOLDER = /^\(?(?:unspecified|anonymous|untitled)\)?$/i;

export function softwareName(value: string): { name: string; aiNote?: string } {
  const hit = KNOWN.find(([re]) => re.test(value));
  if (hit) return { name: hit[1], aiNote: hit[2] };
  return { name: value.replace(/\s+/g, ' ').trim().slice(0, 40) };
}

const FIELDS: [string, string][] = [
  ['pdf.creator', 'Créateur du PDF'],
  ['xmp.creatortool', 'Outil créateur (XMP)'],
  ['pdf.producer', 'Producteur du PDF'],
  ['xmp.producer', 'Producteur (XMP)'],
  ['docx.application', 'Application du .docx'],
  ['docx.creator', 'Créateur du .docx'],
  ['docx.lastmodifiedby', 'Modifié par'],
  ['docx.description', 'Description du .docx'],
];

export function identifySoftware(raw: Record<string, string>): SoftwareHint[] {
  const found = new Map<string, SoftwareHint>();
  const add = (hint: SoftwareHint) => {
    const prev = found.get(hint.name);
    if (!prev) found.set(hint.name, hint);
    else if (!prev.source.includes(hint.source)) prev.source += ` · ${hint.source}`;
  };

  // python-docx part d'un vieux modèle Word : sa fiche « application » ne dit rien du vrai outil
  const fromTemplate = /python-docx/i.test(`${raw['docx.creator'] ?? ''} ${raw['docx.description'] ?? ''}`);

  for (const [key, label] of FIELDS) {
    const value = raw[key];
    if (!value || PLACEHOLDER.test(value)) continue;
    const isPerson = key === 'docx.creator' || key === 'docx.lastmodifiedby' || key === 'docx.description';
    const { name, aiNote } = softwareName(value);
    // créateur / modifié par d'un .docx : c'est normalement un nom de personne
    if (isPerson && !KNOWN.some(([re]) => re.test(value))) continue;
    if (key === 'docx.application' && fromTemplate) {
      add({
        name,
        confidence: 10,
        source: `${label} : « ${value.slice(0, 60)} », hérité du modèle par défaut de python-docx`,
      });
      continue;
    }
    add({ name, confidence: 95, source: `${label} : « ${value.slice(0, 60)} »`, aiNote });
  }
  if (raw['pdf.reportlab'] === '1') {
    add({
      name: 'ReportLab',
      confidence: 95,
      source: 'En-tête « ReportLab Generated PDF document »',
      aiNote: KNOWN[0][2],
    });
  }
  if (raw['docx.hasapp'] !== undefined && !raw['docx.application'] && found.size === 0) {
    add({
      name: 'Programme non identifié',
      confidence: 60,
      source:
        'Aucune application déclarée : fichier assemblé par un programme, pas enregistré par un traitement de texte',
    });
  }
  return [...found.values()];
}
