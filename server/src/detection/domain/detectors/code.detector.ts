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
      vendors: [
        { vendor: 'claude', weight: 1 },
        { vendor: 'chatgpt', weight: 1 },
      ],
    });

    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length >= 30) {
      const comments = lines.filter((l) => /^\s*(?:#(?!!)|\/\/|\/\*|\*|--|<!--)/.test(l)).length;
      const ratio = comments / lines.length;
      if (ratio > 0.35) {
        signals.push({
          id: 'code-comment-density',
          category: 'code',
          label: `Code très commenté (${Math.round(ratio * 100)} % des lignes)`,
          detail:
            'Les assistants commentent presque chaque bloc ; un code humain de production est rarement aussi annoté.',
          strength: 'faible',
          direction: 'ia',
          points: 6,
        });
      }
    }
    return { signals, highlights };
  }
}
