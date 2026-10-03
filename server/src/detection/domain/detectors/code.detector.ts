import type {
  DetectionContext,
  DetectorResult,
  Highlight,
  Signal,
  SignalDetector,
} from '../signal/signal.js';
import { scan } from './text-scan.js';

const CHAT_LEFTOVER =
  /here(?:'s| is) the (?:updated|complete|full|corrected|fixed|revised) (?:code|version|script)|voici (?:le|la) (?:code|version|script) (?:complet|complète|corrigée?|mise? à jour)/gi;
const PLACEHOLDERS =
  /your[_-]?api[_-]?key|YOUR_[A-Z_]+_HERE|your_[a-z_]+_here|<your[-_ ][a-z ]+>|path\/to\/your|replace with your|remplace[rz]? (?:par|avec) (?:ton|ta|tes|votre|vos)|(?:#|\/\/)\s*(?:example usage|exemple d['’]utilisation|usage example)/gi;
const STEP_COMMENTS = /^\s*(?:#|\/\/|--)\s*(?:step|étape)\s*\d+/gim;
const NARRATION =
  /^\s*(?:#|\/\/)\s*(?:let['’]s|now (?:we|let['’]s)|this (?:function|will|is|code)|here we|ici,? on|maintenant,? on|on va|cette fonction)/gim;
const EMOJI_LOGS =
  /(?:print|console\.(?:log|error|warn|info)|echo|logger\.\w+|log\.\w+)\s*\(?\s*f?["'`][^"'`\n]*(?:[\u{1F300}-\u{1FAFF}]|✅|❌|⚠\uFE0F|✔|✓)/gu;

const HASH_COMMENT_EXTENSIONS = new Set([
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
const TYPOGRAPHY =
  /[\u2014\u2013\u2192\u2190\u21d2\u2260\u2248\u2264\u2265\u2026\u00ab\u00bb\u201c\u201d\u2019]/g;
// en-tête du type ROLE + tiret long + description
const BANNER =
  /^\s*(?:\/\*\*?|\/\/|#)?\s*\*?\s*(?!TODO|FIXME|NOTE|HACK|XXX|WARNING|IMPORTANT)[A-ZÀ-Ý][A-ZÀ-Ý0-9'/]{2,}(?: [A-ZÀ-Ý0-9'/]+)*\s*[\u2014\u2013]\s+\S[^\n]*/m;

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
    const text = doc.text;
    const signals: Signal[] = [];
    const highlights: Highlight[] = [];

    const push = (
      id: string,
      re: RegExp,
      min: number,
      s: Omit<Signal, 'id' | 'category' | 'evidence' | 'count' | 'direction'>,
    ) => {
      const r = scan(text, re, id, s.strength, 4);
      if (r.count < min) return;
      highlights.push(...r.highlights);
      signals.push({ id, category: 'code', direction: 'ia', evidence: r.evidence, count: r.count, ...s });
    };

    push('code-chat', CHAT_LEFTOVER, 1, {
      label: 'Phrase de chatbot restée dans le code',
      detail: '« Here is the updated code… » / « Voici le code complet… » copié avec le code.',
      strength: 'fort',
      points: 30,
    });
    push('code-placeholders', PLACEHOLDERS, 1, {
      label: 'Placeholders et « Example usage » typiques des assistants',
      detail:
        "« YOUR_API_KEY », « path/to/your… », « # Example usage » : gabarit des réponses d'IA, laissé tel quel.",
      strength: 'moyen',
      points: 14,
    });
    push('code-steps', STEP_COMMENTS, 2, {
      label: 'Commentaires « Étape 1, Étape 2… »',
      detail: 'Commentaires pédagogiques numérotés, habitude des réponses générées.',
      strength: 'faible',
      points: 8,
    });
    push('code-narration', NARRATION, 3, {
      label: 'Commentaires narratifs (« Now we… », « Cette fonction… »)',
      detail: "Commentaires qui racontent le code comme une explication : style d'assistant IA.",
      strength: 'faible',
      points: 6,
    });
    push('code-emoji-logs', EMOJI_LOGS, 2, {
      label: 'Émojis dans les messages de log (✅ ❌ 🚀)',
      detail:
        "Claude et ChatGPT ponctuent volontiers les print/console.log d'émojis. Beaucoup de développeurs aussi.",
      strength: 'faible',
      points: 8,
    });

    const ranges = commentRanges(text, doc.extension);
    const marks: Highlight[] = [];
    const kinds = new Set<string>();
    for (const [start, end] of ranges) {
      for (const m of text.slice(start, end).matchAll(TYPOGRAPHY)) {
        const at = start + (m.index ?? 0);
        kinds.add(m[0]);
        marks.push({ start: at, end: at + m[0].length, signalId: 'code-typography', level: 'moyen' });
      }
    }
    if (marks.length >= 3 || kinds.size >= 2) {
      const strong = marks.length >= 6 || kinds.size >= 3;
      highlights.push(...marks.slice(0, 200));
      signals.push({
        id: 'code-typography',
        category: 'code',
        label: `Typographie de rédaction dans les commentaires (${[...kinds].join(' ')})`,
        detail:
          "Tirets longs, flèches, guillemets « » ou points de suspension typographiques : ces caractères ne se tapent pas au clavier dans un éditeur de code. Les assistants IA les écrivent naturellement dans leurs commentaires ; on n'en trouve presque jamais dans du code humain.",
        strength: strong ? 'moyen' : 'faible',
        direction: 'ia',
        points: strong ? 22 : 12,
        vendors: [
          { vendor: 'chatgpt', weight: 1 },
          { vendor: 'claude', weight: 1 },
        ],
        evidence: [
          ...new Set(
            marks.slice(0, 40).map((h) =>
              text
                .slice(Math.max(0, h.start - 30), h.end + 30)
                .replace(/\s+/g, ' ')
                .trim(),
            ),
          ),
        ].slice(0, 3),
        count: marks.length,
      });
    }

    const banner = text.slice(0, 800).match(BANNER);
    if (banner) {
      const start = banner.index ?? 0;
      highlights.push({ start, end: start + banner[0].length, signalId: 'code-banner', level: 'moyen' });
      signals.push({
        id: 'code-banner',
        category: 'code',
        label: 'En-tête de fichier « RÔLE — description »',
        detail:
          "Le fichier s'ouvre sur un intitulé en capitales suivi d'un tiret long (« SERVICE DE DOMAINE — … », « ADAPTER — … ») : présentation systématique des fichiers générés par un assistant, absente du code humain étudié.",
        strength: 'moyen',
        direction: 'ia',
        points: 22,
        vendors: [
          { vendor: 'claude', weight: 1 },
          { vendor: 'chatgpt', weight: 1 },
        ],
        evidence: [banner[0].trim().slice(0, 120)],
      });
    }

    return { signals, highlights };
  }
}
