import type {
  DetectionContext,
  DetectorResult,
  Highlight,
  Signal,
  SignalDetector,
  Strength,
} from '../signal/signal.js';
import type { ProjectFile } from '../document/source-document.js';
import { excerpt, scan } from './text-scan.js';
import { paraphrasingComments } from './comment-paraphrase.js';

const CHAT_LEFTOVER =
  /here(?:'s| is) the (?:updated|complete|full|corrected|fixed|revised) (?:code|version|script)|voici (?:le|la) (?:code|version|script) (?:complet|complète|corrigée?|mise? à jour)/gi;
const PLACEHOLDERS =
  /your[_-]?api[_-]?key|YOUR_[A-Z_]+_HERE|your_[a-z_]+_here|<your[-_ ][a-z ]+>|path\/to\/your|replace with your|remplace[rz]? (?:par|avec) (?:ton|ta|tes|votre|vos)|(?:#|\/\/)\s*(?:example usage|exemple d['’]utilisation|usage example)/gi;
const STEP_COMMENTS = /^\s*(?:#|\/\/|--)\s*(?:step|étape)\s*\d+/gim;
const NARRATION =
  /^\s*(?:#|\/\/)\s*(?:let['’]s|now (?:we|let['’]s)|this (?:function|will|is|code)|here we|ici,? on|maintenant,? on|on va|cette fonction)/gim;
const EMOJI_LOGS =
  /(?:print|console\.(?:log|error|warn|info)|echo|logger\.\w+|log\.\w+)\s*\(?\s*f?["'`][^"'`\n]*(?:[\u{1F300}-\u{1FAFF}]|✅|❌|⚠️|✔|✓)/gu;

export const HASH_COMMENT_EXTENSIONS = new Set([
  'py',
  'sh',
  'bash',
  'zsh',
  'rb',
  'yml',
  'yaml',
  'toml',
  'r',
  'pl',
  'ps1',
  'conf',
]);
// caractères qu'on ne tape pas au clavier dans un éditeur de code
const TYPOGRAPHY = /[—–→←⇒≠≈≤≥…«»“”’]/g;
// en-tête du type ROLE + tiret long + description
const BANNER =
  /^\s*(?:\/\*\*?|\/\/|#)?\s*\*?\s*(?!TODO|FIXME|NOTE|HACK|XXX|WARNING|IMPORTANT)[A-ZÀ-Ý][A-ZÀ-Ý0-9'/]{2,}(?: [A-ZÀ-Ý0-9'/]+)*\s*[—–]\s+\S[^\n]*/m;

type Spec = Omit<Signal, 'id' | 'category' | 'evidence' | 'count' | 'direction'>;

interface Hit {
  count: number;
  highlights: Highlight[];
  evidence: string[];
  files: number;
  kinds?: Set<string>;
  // au moins un fichier franchit le palier fort
  strong?: boolean;
}

const PATTERNS: [string, RegExp, number, Spec][] = [
  [
    'code-chat',
    CHAT_LEFTOVER,
    1,
    {
      label: 'Phrase de chatbot restée dans le code',
      detail: '« Here is the updated code… » / « Voici le code complet… » copié avec le code.',
      strength: 'fort',
      points: 30,
    },
  ],
  [
    'code-placeholders',
    PLACEHOLDERS,
    1,
    {
      label: 'Placeholders et « Example usage » typiques des assistants',
      detail:
        "« YOUR_API_KEY », « path/to/your… », « # Example usage » : gabarit des réponses d'IA, laissé tel quel.",
      strength: 'moyen',
      points: 14,
    },
  ],
  [
    'code-steps',
    STEP_COMMENTS,
    2,
    {
      label: 'Commentaires « Étape 1, Étape 2… »',
      detail: 'Commentaires pédagogiques numérotés, habitude des réponses générées.',
      strength: 'faible',
      points: 8,
    },
  ],
  [
    'code-narration',
    NARRATION,
    3,
    {
      label: 'Commentaires narratifs (« Now we… », « Cette fonction… »)',
      detail: "Commentaires qui racontent le code comme une explication : style d'assistant IA.",
      strength: 'faible',
      points: 6,
    },
  ],
  [
    'code-emoji-logs',
    EMOJI_LOGS,
    2,
    {
      label: 'Émojis dans les messages de log (✅ ❌ 🚀)',
      detail:
        "Claude et ChatGPT ponctuent volontiers les print/console.log d'émojis. Beaucoup de développeurs aussi.",
      strength: 'faible',
      points: 8,
    },
  ],
];

function commentRanges(text: string, extension: string | null): [number, number][] {
  const re = HASH_COMMENT_EXTENSIONS.has(extension ?? '')
    ? /(?:^|\s)#(?![!{])[^\n]*/gm
    : /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
  return [...text.matchAll(re)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length]);
}

export class CodeDetector implements SignalDetector {
  readonly name = 'code';

  detect({ doc }: DetectionContext): DetectorResult {
    if (doc.kind !== 'code') return { signals: [], highlights: [] };
    const files: ProjectFile[] = doc.project?.files ?? [
      { path: doc.filename ?? '', extension: doc.extension, start: 0, end: doc.text.length },
    ];
    const inProject = doc.project !== undefined;
    const hits = new Map<string, Hit>();
    const record = (id: string, file: ProjectFile, h: Omit<Hit, 'files'>) => {
      const cur = hits.get(id) ?? { count: 0, highlights: [], evidence: [], files: 0, kinds: new Set() };
      cur.count += h.count;
      cur.files++;
      cur.highlights.push(
        ...h.highlights.map((x) => ({ ...x, start: x.start + file.start, end: x.end + file.start })),
      );
      for (const e of h.evidence)
        if (cur.evidence.length < 4) cur.evidence.push(inProject ? `${file.path} : ${e}` : e);
      for (const k of h.kinds ?? []) cur.kinds!.add(k);
      cur.strong ||= h.strong;
      hits.set(id, cur);
    };
    for (const file of files) this.scanFile(doc.text.slice(file.start, file.end), file, record);

    const signals: Signal[] = [];
    const highlights: Highlight[] = [];
    const where = (h: Hit) =>
      inProject ? ` (${h.files} fichier${h.files > 1 ? 's' : ''} sur ${files.length})` : '';
    const push = (id: string, h: Hit, s: Spec, extra: Partial<Signal> = {}) => {
      highlights.push(...h.highlights.slice(0, 300));
      signals.push({
        id,
        category: 'code',
        direction: 'ia',
        evidence: h.evidence,
        count: h.count,
        ...s,
        label: s.label + where(h),
        ...extra,
      });
    };

    for (const [id, , , spec] of PATTERNS) {
      const h = hits.get(id);
      if (h) push(id, h, spec);
    }
    const typo = hits.get('code-typography');
    if (typo) {
      const strong = typo.strong ?? false;
      push(
        'code-typography',
        typo,
        {
          label: `Typographie de rédaction dans les commentaires (${[...(typo.kinds ?? [])].join(' ')})`,
          detail:
            "Tirets longs, flèches, guillemets « » ou points de suspension typographiques : ces caractères ne se tapent pas au clavier dans un éditeur de code. Les assistants IA les écrivent naturellement dans leurs commentaires ; on n'en trouve presque jamais dans du code humain.",
          strength: strong ? 'moyen' : 'faible',
          points: strong ? 22 : 12,
        },
        {
          vendors: [
            { vendor: 'chatgpt', weight: 1 },
            { vendor: 'claude', weight: 1 },
          ],
          evidence: [...new Set(typo.evidence)].slice(0, 3),
        },
      );
    }
    const banner = hits.get('code-banner');
    if (banner) {
      push(
        'code-banner',
        banner,
        {
          label: 'En-tête de fichier « RÔLE — description »',
          detail:
            "Le fichier s'ouvre sur un intitulé en capitales suivi d'un tiret long (« SERVICE DE DOMAINE — … », « ADAPTER — … ») : présentation systématique des fichiers générés par un assistant, absente du code humain étudié.",
          strength: 'moyen',
          points: 22,
        },
        {
          vendors: [
            { vendor: 'claude', weight: 1 },
            { vendor: 'chatgpt', weight: 1 },
          ],
        },
      );
    }
    const para = hits.get('code-paraphrase');
    if (para) {
      push('code-paraphrase', para, {
        label: `Commentaires qui répètent la ligne de code suivante : ${para.count}`,
        detail:
          "« // Récupère l'utilisateur » juste au-dessus de « getUser() » : le commentaire redit ce que le code dit déjà. Habitude marquée des assistants, qui commentent chaque étape ; un développeur commente plutôt le pourquoi. Indice faible : certains développeurs ou consignes d'équipe font pareil.",
        strength: 'faible',
        points: 10,
      });
    }

    return { signals, highlights };
  }

  private scanFile(
    text: string,
    file: ProjectFile,
    record: (id: string, file: ProjectFile, h: Omit<Hit, 'files'>) => void,
  ): void {
    for (const [id, re, min, spec] of PATTERNS) {
      const r = scan(text, re, id, spec.strength, 4);
      if (r.count >= min) record(id, file, r);
    }

    const marks: Highlight[] = [];
    const kinds = new Set<string>();
    for (const [start, end] of commentRanges(text, file.extension)) {
      for (const m of text.slice(start, end).matchAll(TYPOGRAPHY)) {
        const at = start + (m.index ?? 0);
        kinds.add(m[0]);
        marks.push({ start: at, end: at + m[0].length, signalId: 'code-typography', level: 'moyen' });
      }
    }
    if (marks.length >= 3 || kinds.size >= 2) {
      record('code-typography', file, {
        count: marks.length,
        highlights: marks.slice(0, 200),
        evidence: marks.slice(0, 40).map((h) =>
          text
            .slice(Math.max(0, h.start - 30), h.end + 30)
            .replace(/\s+/g, ' ')
            .trim(),
        ),
        kinds,
        strong: marks.length >= 6 || kinds.size >= 3,
      });
    }

    const banner = text.slice(0, 800).match(BANNER);
    if (banner) {
      const start = banner.index ?? 0;
      record('code-banner', file, {
        count: 1,
        highlights: [{ start, end: start + banner[0].length, signalId: 'code-banner', level: 'moyen' }],
        evidence: [banner[0].trim().slice(0, 120)],
      });
    }

    const para = paraphrasingComments(text, file.extension);
    if (para) {
      const level: Strength = 'faible';
      record('code-paraphrase', file, {
        count: para.length,
        highlights: para.map((p) => ({ start: p.start, end: p.end, signalId: 'code-paraphrase', level })),
        evidence: para.slice(0, 2).map((p) => excerpt(text, p.start, p.codeEnd, 0)),
      });
    }
  }
}
