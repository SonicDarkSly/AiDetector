import {
  NO_SIGNAL,
  type DetectionContext,
  type DetectorResult,
  type Signal,
  type SignalDetector,
} from '../signal/signal.js';
import { OTHER_AI_TOOLS_RE, vendorOf, type Vendor, type VendorHint } from '../signal/vendor.js';

interface GeneratorRule {
  re: RegExp;
  label: string;
  points: number;
  strength: Signal['strength'];
  direction: Signal['direction'];
  detail: string;
  vendors?: VendorHint[];
}

const PDF_GENERATORS: GeneratorRule[] = [
  {
    re: /reportlab/i,
    label: 'PDF généré par ReportLab (script Python)',
    points: 12,
    strength: 'moyen',
    direction: 'ia',
    detail:
      "ReportLab est une bibliothèque Python : le PDF a été fabriqué par un programme. C'est l'outil qu'utilisent ChatGPT et Claude quand ils créent un PDF, mais aussi beaucoup de logiciels (factures, relevés, attestations). Indice seulement pour un document « rédigé » (lettre, rapport).",
    vendors: [
      { vendor: 'script', weight: 3 },
      { vendor: 'chatgpt', weight: 1 },
      { vendor: 'claude', weight: 1 },
    ],
  },
  {
    re: /matplotlib/i,
    label: 'PDF généré par Matplotlib (graphique Python)',
    points: 14,
    strength: 'moyen',
    direction: 'ia',
    detail:
      'Graphique produit par un script Python, typique des graphiques fournis par ChatGPT / Claude en mode analyse.',
    vendors: [
      { vendor: 'script', weight: 3 },
      { vendor: 'chatgpt', weight: 1 },
      { vendor: 'claude', weight: 1 },
    ],
  },
  {
    re: /fpdf|weasyprint|wkhtmltopdf|xhtml2pdf|\bpisa\b|pdfkit|jspdf|pdf-lib|pdfmake|puppeteer|playwright|headlesschrome|prince(xml)?\b|docraptor|pandoc|typst/i,
    label: 'PDF fabriqué par un programme',
    points: 5,
    strength: 'faible',
    direction: 'ia',
    detail:
      "Outil de conversion HTML→PDF ou de génération automatique (WeasyPrint, wkhtmltopdf, Chrome sans interface…). Ce n'est pas un outil d'IA : la plupart de ces PDF viennent de sites web et de logiciels (factures, billets, rapports). Indice très faible, seulement parce qu'un assistant IA qui « code » un PDF passe aussi par ce genre d'outil.",
    vendors: [{ vendor: 'script', weight: 2 }],
  },
  {
    re: /pypdf|pikepdf|pymupdf|\bfitz\b|qpdf|ghostscript/i,
    label: 'PDF retraité par un outil de manipulation',
    points: 4,
    strength: 'faible',
    direction: 'neutre',
    detail: "Outil de fusion/compression/réécriture de PDF : il masque souvent le logiciel d'origine.",
  },
  {
    re: /google docs/i,
    label: 'Exporté depuis Google Docs',
    points: -4,
    strength: 'info',
    direction: 'humain',
    detail:
      "Exporté par un traitement de texte utilisé par un humain. Ne dit rien de l'origine du TEXTE (il a pu être collé depuis une IA).",
  },
  {
    re: /microsoft.{0,4}(word|office|excel|powerpoint)|word for (office|microsoft)|acrobat pdfmaker|adobe (indesign|illustrator|photoshop|acrobat)|acrobat distiller|\bpages\b|keynote|libreoffice|openoffice|writer/i,
    label: 'Exporté depuis un logiciel bureautique',
    points: -4,
    strength: 'info',
    direction: 'humain',
    detail:
      'Logiciel utilisé par un humain (Word, Pages, InDesign, LibreOffice…). Attention : Claude et ChatGPT convertissent aussi parfois via LibreOffice ; et le texte a pu être collé depuis une IA.',
  },
  {
    re: /skia\/pdf|chrom(e|ium)|microsoft edge|safari|firefox|quartz pdfcontext/i,
    label: 'Impression « Enregistrer en PDF » (navigateur / macOS)',
    points: 0,
    strength: 'info',
    direction: 'neutre',
    detail:
      "PDF imprimé depuis un navigateur ou macOS. Neutre : c'est aussi la façon habituelle d'enregistrer une conversation ChatGPT / Claude / Gemini en PDF (vérifier le titre).",
  },
  {
    re: /pdftex|xetex|luatex|latex|dvipdf/i,
    label: 'Composé avec LaTeX',
    points: 0,
    strength: 'info',
    direction: 'neutre',
    detail: 'Document scientifique/technique composé en LaTeX (humain ou IA : neutre).',
  },
];

const DOCX_LIBS: { re: RegExp; label: string; detail: string; vendors: VendorHint[] }[] = [
  {
    re: /python-docx/i,
    label: 'DOCX généré par python-docx (script Python)',
    detail:
      "Le créateur « python-docx » est la valeur par défaut de la bibliothèque Python utilisée par ChatGPT pour fabriquer des fichiers Word. Un humain qui écrit dans Word n'a jamais cette valeur.",
    vendors: [
      { vendor: 'script', weight: 3 },
      { vendor: 'chatgpt', weight: 2 },
      { vendor: 'claude', weight: 1 },
    ],
  },
  {
    re: /^un-named$/i,
    label: 'DOCX généré par la bibliothèque « docx » (JavaScript)',
    detail:
      "« Un-named » est l'auteur par défaut de docx-js, la bibliothèque JavaScript notamment utilisée par Claude pour générer des documents Word.",
    vendors: [
      { vendor: 'script', weight: 3 },
      { vendor: 'claude', weight: 2 },
    ],
  },
  {
    re: /aspose|officegen|docx4j|openxml ?sdk|documentformat\.openxml|phpword|docxtemplater|syncfusion|gembox|spire\.doc/i,
    label: 'DOCX généré par une bibliothèque de programmation',
    detail: 'Fichier Word fabriqué par un programme (pas enregistré depuis Word par une personne).',
    vendors: [{ vendor: 'script', weight: 2 }],
  },
];

const AI_DOCSOURCE_RE =
  /trainedalgorithmicmedia|compositewithtrainedalgorithmicmedia|algorithmicmedia|compositesynthetic/i;

function isUtcPdfDate(d: string | undefined): boolean {
  if (!d) return false;
  return /D?:?\d{14}(Z|\+00'?00'?|-00'?00'?)/.test(d.replace(/\s/g, ''));
}

export class MetadataDetector implements SignalDetector {
  readonly name = 'metadata';

  detect({ doc, stats }: DetectionContext): DetectorResult {
    const raw = doc.raw;
    if (doc.kind !== 'pdf' && doc.kind !== 'docx') return NO_SIGNAL;
    const signals: Signal[] = [];

    const fields: [string, string | undefined][] = [
      ['Producteur', raw['pdf.producer']],
      ['Créateur', raw['pdf.creator']],
      ['Auteur', raw['pdf.author'] ?? raw['docx.creator']],
      ['Titre', raw['pdf.title'] ?? raw['docx.title']],
      ['Sujet', raw['pdf.subject']],
      ['Mots-clés', raw['pdf.keywords']],
      ['Outil créateur (XMP)', raw['xmp.creatortool']],
      ['Modifié par', raw['docx.lastmodifiedby']],
      ['Description', raw['docx.description']],
      ['Application', raw['docx.application']],
      ['Société', raw['docx.company']],
      ['Modèle', raw['docx.template']],
      ['Propriétés personnalisées', raw['docx.custom']],
      ['Générateur C2PA', raw['c2pa.generator']],
    ];

    const CONTENT_FIELDS = new Set(['Titre', 'Sujet', 'Mots-clés', 'Description']);
    const EXPORT_TITLE_RE =
      /^\s*(chat\s?gpt|claude|gemini|copilot|perplexity|le chat|mistral|deepseek|grok)\s*[-\u2013\u2014|:·]/i;
    const named: string[] = [];
    let toolLevel = false;
    const vendorHints = new Map<Vendor, number>();

    const PERSON_FIELDS = new Set(['Auteur', 'Modifié par']);
    const EXACT_AI_RE =
      /^\s*(chat\s?gpt|openai|claude(\s*ai)?|anthropic|(google\s*)?gemini|bard|(microsoft\s*)?copilot|perplexity(\s*ai)?|mistral(\s*ai)?|le chat|deepseek|grok)\s*$/i;
    for (const [label, value] of fields) {
      if (!value) continue;
      if (PERSON_FIELDS.has(label) && !EXACT_AI_RE.test(value)) continue;

      if (
        CONTENT_FIELDS.has(label) &&
        !EXPORT_TITLE_RE.test(value) &&
        !/chat\s?gpt|openai|anthropic|\bgemini\b|copilot|perplexity|deepseek|mistral\s?ai|\bgrok\b/i.test(
          value,
        ) &&
        !OTHER_AI_TOOLS_RE.test(value)
      )
        continue;
      const v = vendorOf(value);
      if (v || OTHER_AI_TOOLS_RE.test(value)) {
        named.push(`${label} : « ${value.slice(0, 120)} »`);
        const strong = !CONTENT_FIELDS.has(label) || EXPORT_TITLE_RE.test(value);
        if (strong) toolLevel = true;
        if (v) vendorHints.set(v, Math.max(vendorHints.get(v) ?? 0, strong ? 3 : 1));
      }
    }
    if (named.length > 0) {
      signals.push({
        id: 'meta-ai-name',
        category: 'metadata',
        label: toolLevel
          ? 'Une IA est déclarée comme outil créateur dans les métadonnées'
          : 'Une IA est mentionnée dans le titre/sujet du fichier',
        detail: toolLevel
          ? "Le nom d'un assistant IA (ou d'un outil d'écriture IA) figure dans les champs qui décrivent QUI a fabriqué le fichier, ou dans un titre d'export de conversation."
          : "Le titre ou le sujet cite une IA : cela peut être un export de conversation… ou simplement un document qui parle d'IA. Indice modéré.",
        strength: toolLevel ? 'fort' : 'moyen',
        direction: 'ia',
        points: toolLevel ? 40 : 12,
        vendors: [...vendorHints].map(([vendor, weight]) => ({ vendor, weight })),
        evidence: named.slice(0, 5),
      });
    }

    if (raw['xmp.digitalsourcetype'] && AI_DOCSOURCE_RE.test(raw['xmp.digitalsourcetype'])) {
      signals.push({
        id: 'meta-iptc-ai',
        category: 'metadata',
        label: 'Le fichier se déclare lui-même « généré par IA » (IPTC)',
        detail:
          "Le champ normalisé IPTC DigitalSourceType vaut « trainedAlgorithmicMedia » (ou variante) : l'outil créateur a marqué le contenu comme produit par une IA.",
        strength: 'fort',
        direction: 'ia',
        points: 45,
        evidence: [raw['xmp.digitalsourcetype']],
      });
    }

    if (raw['c2pa'] === '1') {
      const gen = raw['c2pa.generator'];
      const v = gen ? vendorOf(gen) : null;
      signals.push({
        id: 'meta-c2pa',
        category: 'metadata',
        label: 'Manifeste de provenance C2PA (Content Credentials) présent',
        detail:
          'Le fichier contient un manifeste C2PA : OpenAI, Adobe Firefly, Microsoft, Google… en ajoutent aux contenus générés. Vérifiable en détail sur contentcredentials.org/verify.',
        strength: v ? 'fort' : 'moyen',
        direction: 'ia',
        points: v ? 35 : 15,
        vendors: v ? [{ vendor: v, weight: 3 }] : undefined,
        evidence: gen ? [`Générateur : ${gen}`] : undefined,
      });
    }

    if (doc.kind === 'pdf') signals.push(...this.pdfSignals(raw));
    if (doc.kind === 'docx') signals.push(...this.docxSignals(raw, stats.words));
    return { signals, highlights: [] };
  }

  private pdfSignals(raw: Record<string, string>): Signal[] {
    const out: Signal[] = [];
    const tool = [raw['pdf.producer'], raw['pdf.creator'], raw['xmp.creatortool'], raw['xmp.producer']]
      .filter(Boolean)
      .join(' · ');

    const rule =
      PDF_GENERATORS.find((g) => g.re.test(tool)) ??
      (raw['pdf.reportlab'] === '1' ? PDF_GENERATORS[0] : undefined);
    if (rule) {
      out.push({
        id: 'meta-pdf-generator',
        category: 'metadata',
        label: rule.label,
        detail: rule.detail,
        strength: rule.strength,
        direction: rule.direction,
        points: rule.points,
        vendors: rule.vendors,
        evidence: [tool || 'commentaire « ReportLab Generated PDF document »'],
      });
    }

    const defaults = [
      /^\(?anonymous\)?$/i.test(raw['pdf.author'] ?? '') && `Auteur = « ${raw['pdf.author']} »`,
      /^\(?(untitled|anonymous)\)?$/i.test(raw['pdf.title'] ?? '') && `Titre = « ${raw['pdf.title']} »`,
      /^\(?unspecified\)?$/i.test(raw['pdf.subject'] ?? '') && `Sujet = « ${raw['pdf.subject']} »`,
      /^\(?unspecified\)?$/i.test(raw['pdf.creator'] ?? '') && `Créateur = « ${raw['pdf.creator']} »`,
    ].filter(Boolean) as string[];
    if (defaults.length >= 2) {
      out.push({
        id: 'meta-pdf-defaults',
        category: 'metadata',
        label: "Métadonnées par défaut d'un script (non renseignées)",
        detail:
          'Valeurs laissées par défaut par la bibliothèque ReportLab : le PDF a été produit par un script automatique, sans personnalisation.',
        strength: 'moyen',
        direction: 'ia',
        points: 8,
        vendors: [{ vendor: 'script', weight: 2 }],
        evidence: defaults,
      });
    }

    if (isUtcPdfDate(raw['pdf.creationdate']) && !/microsoft|word|pages|quartz/i.test(tool)) {
      out.push({
        id: 'meta-pdf-utc',
        category: 'metadata',
        label: 'Créé sur une machine réglée en UTC',
        detail:
          "La date de création est en temps universel (+00:00). C'est le cas des serveurs et des bacs à sable où ChatGPT / Claude exécutent leur code ; un ordinateur personnel en France ou en Suisse écrit +01:00 / +02:00. Indice faible (certains outils écrivent toujours en UTC).",
        strength: 'faible',
        direction: 'ia',
        points: 5,
        evidence: [raw['pdf.creationdate']],
      });
    }

    if (!tool && !raw['pdf.author'] && !raw['pdf.title']) {
      out.push({
        id: 'meta-pdf-empty',
        category: 'metadata',
        label: 'Métadonnées absentes',
        detail:
          'Aucun logiciel ni auteur déclaré : métadonnées effacées (nettoyage volontaire, outil minimal) ou placées dans un flux compressé illisible ici. Neutre, mais empêche toute vérification.',
        strength: 'info',
        direction: 'neutre',
        points: 2,
      });
    }
    return out;
  }

  private docxSignals(raw: Record<string, string>, words: number): Signal[] {
    const out: Signal[] = [];
    const creator = raw['docx.creator'] ?? '';
    const lastBy = raw['docx.lastmodifiedby'] ?? '';
    const desc = raw['docx.description'] ?? '';

    for (const lib of DOCX_LIBS) {
      const hit = [creator, lastBy, desc, raw['docx.application'] ?? ''].find((v) => v && lib.re.test(v));
      if (!hit) continue;
      const evidence = [
        creator && `Créateur : « ${creator} »`,
        lastBy && `Modifié par : « ${lastBy} »`,
        desc && `Description : « ${desc.slice(0, 80)} »`,
      ].filter(Boolean) as string[];
      if (raw['docx.created']?.startsWith('2013-12-23T23:15')) {
        evidence.push('Date de création = 23/12/2013 23:15 (date figée du modèle par défaut de python-docx)');
      }
      out.push({
        id: 'meta-docx-lib',
        category: 'metadata',
        label: lib.label,
        detail: lib.detail,
        strength: 'fort',
        direction: 'ia',
        points: 32,
        vendors: lib.vendors,
        evidence,
      });
      break;
    }

    const fromLib = out.some((s) => s.id === 'meta-docx-lib');
    const app = raw['docx.application'] ?? '';
    const isWordLike = /word|libreoffice|openoffice|pages|wps|onlyoffice|google/i.test(app);
    if (raw['docx.hasapp'] === '0' || !app) {
      out.push({
        id: 'meta-docx-noapp',
        category: 'metadata',
        label: 'Aucune application bureautique déclarée',
        detail:
          "Le fichier ne contient pas la fiche « application » qu'écrivent Word, LibreOffice ou Pages à l'enregistrement : il a été assemblé par un programme. (Certains exports en ligne n'en ont pas non plus.)",
        strength: 'moyen',
        direction: 'ia',
        points: 10,
        vendors: [{ vendor: 'script', weight: 1 }],
      });
    }

    const totalTime = Number(raw['docx.totaltime']);
    const revision = Number(raw['docx.revision']);
    if (!fromLib && isWordLike && Number.isFinite(totalTime) && words >= 200) {
      const wpm = words / Math.max(totalTime, 1);
      if (wpm > 120) {
        out.push({
          id: 'meta-docx-paste',
          category: 'metadata',
          label: "Texte arrivé d'un bloc (collé), pas tapé",
          detail: `${words} mots pour ${totalTime} min d'édition enregistrées par le logiciel, soit ~${Math.round(wpm)} mots/min (un humain tape 30 à 60 mots/min). Le texte a été collé depuis ailleurs (une IA ou un autre document).`,
          strength: 'moyen',
          direction: 'ia',
          points: 12,
          evidence: [
            `Temps d'édition : ${totalTime} min`,
            `Révisions : ${Number.isFinite(revision) ? revision : '?'}`,
          ],
        });
      } else if (wpm < 20 && totalTime >= 20) {
        out.push({
          id: 'meta-docx-worked',
          category: 'metadata',
          label: 'Document travaillé dans le temps',
          detail: `${totalTime} min d'édition pour ${words} mots (~${Math.round(wpm)} mots/min) : rythme d'une rédaction humaine (ou d'une longue retouche).`,
          strength: 'faible',
          direction: 'humain',
          points: -8,
          evidence: [
            `Temps d'édition : ${totalTime} min`,
            `Révisions : ${Number.isFinite(revision) ? revision : '?'}`,
          ],
        });
      }
    }

    const rsids = Number(raw['docx.rsids']);
    if (!fromLib && /word/i.test(app) && Number.isFinite(rsids)) {
      if (rsids === 0) {
        out.push({
          id: 'meta-docx-norsid',
          category: 'metadata',
          label: "Se déclare « Word » sans aucune session d'édition Word",
          detail:
            "Word inscrit un identifiant (rsid) à chaque session d'édition. Aucun ici : le fichier a probablement été généré par un programme qui imite Word.",
          strength: 'moyen',
          direction: 'ia',
          points: 10,
          vendors: [{ vendor: 'script', weight: 1 }],
        });
      } else if (rsids >= 6) {
        out.push({
          id: 'meta-docx-sessions',
          category: 'metadata',
          label: `${rsids} sessions d'édition Word`,
          detail:
            "Le document a été ouvert et modifié dans Word à de nombreuses reprises : historique d'un travail humain (ce qui n'exclut pas des passages générés puis collés).",
          strength: 'faible',
          direction: 'humain',
          points: -6,
        });
      }
    }
    return out;
  }
}
