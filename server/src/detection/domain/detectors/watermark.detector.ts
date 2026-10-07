import {
  NO_SIGNAL,
  type DetectionContext,
  type DetectorResult,
  type SignalDetector,
} from '../signal/signal.js';

// estimation grossière : les tokenizers des assistants comptent environ 1,3 token par mot en français ou en anglais
const TOKENS_PER_WORD = 1.3;
const MIN_WORDS = 20;

// seuils tirés des chiffres publiés par OpenAI (textGrain) : ~80 % détectés à 200 tokens, ~95 % à 400
const READABLE_TOKENS = 150;
const LONG_TOKENS = 400;

const MARKED_ASSISTANTS = [
  "Claude (Anthropic) : textes des modèles récents, dans le monde entier, depuis le 2 août 2026. Détection par l'interface d'Anthropic, en accès restreint (régulateurs, médias, chercheurs, enseignement…)",
  "ChatGPT et Codex (OpenAI, « textGrain ») : dans l'Union européenne, déploiement à partir d'octobre 2026. Détecteur réservé à des chercheurs agréés",
  'Gemini (Google, SynthID Text) : textes marqués depuis 2024. Aucun service public de vérification du texte',
];

export class WatermarkDetector implements SignalDetector {
  readonly name = 'watermark';

  detect({ doc, stats }: DetectionContext): DetectorResult {
    if (stats.words < MIN_WORDS) return NO_SIGNAL;
    const tokens = Math.round(stats.words * TOKENS_PER_WORD);
    const length =
      tokens < READABLE_TOKENS
        ? `Texte court (environ ${tokens} tokens) : même l'éditeur aurait du mal à lire un filigrane sur cette longueur.`
        : tokens < LONG_TOKENS
          ? `Environ ${tokens} tokens : un filigrane serait lisible par l'éditeur si le texte n'a pas été retouché (OpenAI annonce environ 80 % de détection à 200 tokens).`
          : `Environ ${tokens} tokens : longueur suffisante pour que l'éditeur lise un filigrane intact (OpenAI annonce environ 95 % de détection à 400 tokens).`;
    const fragile =
      doc.kind === 'code'
        ? ' Sur du code, le signal est faible : les choix de mots y sont trop contraints.'
        : " Une réécriture, une traduction ou une retouche importante l'effacent.";
    return {
      signals: [
        {
          id: 'watermark-vendor',
          category: 'watermark',
          label: 'Filigrane invisible des éditeurs : non vérifiable ici',
          detail: `Claude, ChatGPT et Gemini marquent leurs textes par un léger biais statistique dans le choix des mots, sans aucun caractère caché. Seul l'éditeur, avec sa clé secrète, peut le lire : l'application ne peut pas le vérifier sans envoyer le texte. ${length}${fragile} L'absence de filigrane ne prouve pas qu'un humain a écrit le texte.`,
          strength: 'info',
          direction: 'neutre',
          points: 0,
          evidence: MARKED_ASSISTANTS,
        },
      ],
      highlights: [],
    };
  }
}
