import type { DocKind, SignalCategory, Strength, Vendor } from './types';

export const IA_GRADIENT = 'linear-gradient(135deg, #d52b1e 0%, #b0179a 52%, #6d28d9 100%)';
export const IA_RING_GRADIENT =
  'conic-gradient(from var(--ia-angle), #d52b1e, #b0179a, #7c3aed, #ff9ae6, #7c3aed, #b0179a, #d52b1e)';

export const PRIMARY = '#7c3aed';

export const ACCEPT =
  '.zip,.pdf,.docx,.txt,.text,.md,.markdown,.mdx,.rst,.csv,.log,.js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.java,.kt,.cs,.c,.h,.cpp,.hpp,.go,.rs,.rb,.php,.swift,.dart,.lua,.r,.sql,.sh,.bash,.zsh,.ps1,.bat,.html,.htm,.css,.scss,.vue,.svelte,.json,.yaml,.yml,.toml,.xml,.ipynb';

export function scoreColor(pct: number): string {
  if (pct >= 85) return '#cf1322';
  if (pct >= 70) return '#fa541c';
  if (pct >= 50) return '#fa8c16';
  if (pct >= 30) return '#d4b106';
  return '#389e0d';
}

export const CATEGORY_LABELS: Record<SignalCategory, string> = {
  project: 'Projet et historique git',
  metadata: 'Métadonnées du fichier',
  artefact: 'Artefacts de chatbot',
  unicode: 'Caractères cachés',
  model: 'Modèle de langage',
  code: 'Code source',
  style: "Style d'écriture",
  stats: 'Statistiques de rythme',
  watermark: "Filigrane de l'éditeur",
};

export const CATEGORY_HINTS: Record<SignalCategory, string> = {
  project: "Preuve technique : fichiers d'assistant et commits signés",
  metadata: 'Preuve technique : fiable si présente, mais effaçable',
  artefact: 'Preuve technique : déchets de copier-coller depuis un chatbot',
  unicode: 'Preuve technique : caractères invisibles ou déguisés',
  model: 'Mesure statistique : fiable sur texte long, faible sur texte court',
  code: 'Indice : habitudes des assistants de code',
  style: 'Indice : tendance, jamais une preuve',
  stats: 'Indice : tendance, peu fiable sur texte court',
  watermark: "Information : lisible seulement par l'éditeur de l'IA",
};

export const STRENGTH_COLORS: Record<Strength, string> = {
  fort: 'red',
  moyen: 'orange',
  faible: 'gold',
  info: 'default',
};

export const STRENGTH_LABELS: Record<Strength, string> = {
  fort: 'Fort',
  moyen: 'Moyen',
  faible: 'Faible',
  info: 'Info',
};

export const VENDOR_COLORS: Record<Vendor, string> = {
  chatgpt: '#10a37f',
  claude: '#d97757',
  gemini: '#4285f4',
  copilot: '#0078d4',
  perplexity: '#20808d',
  mistral: '#fa500f',
  deepseek: '#4d6bfe',
  grok: '#595959',
  meta: '#0866ff',
  qwen: '#615ced',
  script: '#722ed1',
};

export const KIND_LABELS: Record<DocKind, string> = {
  text: 'Texte collé',
  pdf: 'PDF',
  docx: 'Word (.docx)',
  txt: 'Fichier texte',
  md: 'Markdown',
  code: 'Code source',
};

export const LANGUAGE_LABELS = { fr: 'Français', en: 'Anglais', autre: 'Autre / indéterminée' };

// calibration d'origine (240 textes Claude, ChatGPT, Gemini et Mistral, 400 textes humains), à garder égale à DEFAULT_CALIBRATION
export const MEASURED_RATES = [
  { tokens: 30, detected: 21, falsePositives: 5 },
  { tokens: 50, detected: 22, falsePositives: 5 },
  { tokens: 80, detected: 26, falsePositives: 5 },
  { tokens: 120, detected: 24, falsePositives: 5 },
  { tokens: 200, detected: 21, falsePositives: 5 },
];
