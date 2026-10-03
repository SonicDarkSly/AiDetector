export type Vendor =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'copilot'
  | 'perplexity'
  | 'mistral'
  | 'deepseek'
  | 'grok'
  | 'meta'
  | 'script';

export const VENDOR_LABELS: Record<Vendor, string> = {
  chatgpt: 'ChatGPT (OpenAI)',
  claude: 'Claude (Anthropic)',
  gemini: 'Gemini (Google)',
  copilot: 'Copilot (Microsoft)',
  perplexity: 'Perplexity',
  mistral: 'Le Chat (Mistral)',
  deepseek: 'DeepSeek',
  grok: 'Grok (xAI)',
  meta: 'Meta AI',
  script: 'Fichier généré par un programme',
};

export interface VendorHint {
  vendor: Vendor;
  weight: number;
}

export interface VendorScore {
  vendor: Vendor;
  label: string;
  score: number;
  reasons: string[];
}

const VENDOR_PATTERNS: [RegExp, Vendor][] = [
  [/chat\s?gpt|openai|\bgpt-?(3|4|5|4o|o\d)\b|\bdall-?e\b|\bsora\b/i, 'chatgpt'],
  [/\bclaude\b|anthropic/i, 'claude'],
  [/\bgemini\b|\bbard\b|google\s*(ai\s*studio|deepmind)|notebooklm/i, 'gemini'],
  [/copilot|bing\s*chat/i, 'copilot'],
  [/perplexity/i, 'perplexity'],
  [/mistral|le\s?chat\b/i, 'mistral'],
  [/deepseek/i, 'deepseek'],
  [/\bgrok\b|\bx\.ai\b|\bxai\b/i, 'grok'],
  [/meta\s?ai|\bllama\b/i, 'meta'],
];

export function vendorOf(s: string): Vendor | null {
  for (const [re, v] of VENDOR_PATTERNS) if (re.test(s)) return v;
  return null;
}

export const OTHER_AI_TOOLS_RE =
  /\b(jasper(\.ai)?|copy\.ai|writesonic|rytr|quillbot|notion\s?ai|gamma\.app|gamma ai|tome\.app|beautiful\.ai|magic write|canva\s?(ai|magic)|chatpdf|wordtune|you\.com|poe\.com|character\.ai|firefly)\b/i;
