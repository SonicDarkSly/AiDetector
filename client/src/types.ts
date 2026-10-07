export type DocKind = 'text' | 'pdf' | 'docx' | 'txt' | 'md' | 'code';
export type SignalCategory =
  'project' | 'metadata' | 'artefact' | 'unicode' | 'model' | 'style' | 'stats' | 'code' | 'watermark';
export type Strength = 'fort' | 'moyen' | 'faible' | 'info';
export type Direction = 'ia' | 'humain' | 'neutre';
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
  | 'qwen'
  | 'script';

export interface Signal {
  id: string;
  category: SignalCategory;
  label: string;
  detail: string;
  strength: Strength;
  direction: Direction;
  points: number;
  vendors?: { vendor: Vendor; weight: number }[];
  evidence?: string[];
  count?: number;
}

export interface Highlight {
  start: number;
  end: number;
  signalId: string;
  level: Strength;
}

export interface MetaEntry {
  key: string;
  value: string;
  flagged?: boolean;
}

export interface TextStats {
  chars: number;
  words: number;
  sentences: number;
  paragraphs: number;
  language: 'fr' | 'en' | 'autre';
  avgSentenceLength: number;
  sentenceLengthCv: number;
  lexicalDiversity: number;
  avgWordLength: number;
  emDashPer1000: number;
  bulletLineRatio: number;
}

export interface VendorScore {
  vendor: Vendor;
  label: string;
  score: number;
  level?: 'trace' | 'indice' | 'aucun';
  reasons: string[];
}

export interface OriginScore {
  id: string;
  kind: 'ia' | 'logiciel';
  label: string;
  score: number | null;
  level: 'trace' | 'indice' | 'aucun';
  reasons: string[];
  vendor?: Vendor;
}

export interface LanguageModelUsage {
  name: string | null;
  status: 'used' | 'too-short' | 'skipped' | 'ready' | 'idle' | 'missing' | 'disabled' | 'error';
  tokens?: number;
  elapsedMs?: number;
  domain?: 'prose' | 'technical' | 'verse';
  meanLogProb?: number;
  meanEntropy?: number;
  criterion?: number;
  binoculars?: number;
  rate?: MeasuredRate;
}

export interface MeasuredRate {
  tokens: number;
  detected: number;
  falsePositives: number;
}

export interface Answer {
  label: 'ai' | 'human';
  vendor: string | null;
  tokens: number;
  meanLogProb: number;
  meanEntropy?: number;
  criterion?: number;
  binoculars?: number;
  domain: 'prose' | 'technical' | 'verse';
  model?: string;
  at: string;
}

export interface Calibration {
  origin: 'origine' | 'personnalisée';
  texts: { ai: number; human: number };
  answers: number;
  rates: MeasuredRate[];
  appliedAt: string | null;
}

export interface CalibrationStatus {
  active: Calibration;
  answers: { ai: number; human: number; unused: number; vendors: Record<string, number> };
  minimum: number;
  proposal: {
    calibration: Calibration;
    current: { rates: MeasuredRate[]; correct: number };
    proposed: { correct: number };
    answersUsed: number;
  } | null;
}

export interface ModelActivity {
  phase: 'loading' | 'measuring';
  model: string;
  tokens: number | null;
  since: number;
}

export interface LanguageModelInfo {
  name: string | null;
  status: 'ready' | 'idle' | 'missing' | 'disabled' | 'error';
  parameters: string | null;
  quantization: string | null;
  sizeBytes: number | null;
  maxTokens: number;
  minTokens: number;
  contextSize: number;
}

export interface AnalysisReport {
  id: string;
  analyzedAt: string;
  source: { kind: DocKind; filename: string | null; mimetype: string | null; size: number };
  score: number;
  technicalScore: number;
  styleScore: number;
  modelScore?: number | null;
  languageModel?: LanguageModelUsage | null;
  verdict: string;
  undetermined?: boolean;
  confidence: 'faible' | 'moyenne' | 'élevée';
  summary: string;
  vendors: VendorScore[];
  origins?: OriginScore[];
  signals: Signal[];
  metadata: MetaEntry[];
  stats: TextStats;
  text: string;
  textTruncated: boolean;
  highlights: Highlight[];
  cleaned: { text: string; removed: number } | null;
}

export interface ReportSummary {
  id: string;
  analyzedAt: string;
  kind: DocKind;
  filename: string | null;
  score: number;
  verdict: string;
  undetermined?: boolean;
  topVendor: string | null;
  excerpt: string;
}
