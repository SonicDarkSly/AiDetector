export type DocKind = 'text' | 'pdf' | 'docx' | 'txt' | 'md' | 'code';
export type SignalCategory = 'metadata' | 'artefact' | 'unicode' | 'model' | 'style' | 'stats' | 'code';
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

export interface AnalysisReport {
  id: string;
  analyzedAt: string;
  source: { kind: DocKind; filename: string | null; mimetype: string | null; size: number };
  score: number;
  technicalScore: number;
  styleScore: number;
  modelScore?: number | null;
  verdict: string;
  undetermined?: boolean;
  confidence: 'faible' | 'moyenne' | 'élevée';
  summary: string;
  vendors: VendorScore[];
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
