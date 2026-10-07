import type { SourceDocument } from '../document/source-document.js';
import type { TextStats } from '../text/text-stats.js';
import type { VendorHint } from './vendor.js';

export type SignalCategory =
  'project' | 'metadata' | 'artefact' | 'unicode' | 'model' | 'style' | 'stats' | 'code' | 'watermark';

export const TECHNICAL_CATEGORIES: SignalCategory[] = ['project', 'metadata', 'artefact', 'unicode'];

export type Strength = 'fort' | 'moyen' | 'faible' | 'info';

export type Direction = 'ia' | 'humain' | 'neutre';

export interface Signal {
  id: string;
  category: SignalCategory;
  label: string;
  detail: string;
  strength: Strength;
  direction: Direction;
  points: number;
  vendors?: VendorHint[];
  evidence?: string[];
  count?: number;
}

export interface Highlight {
  start: number;
  end: number;
  signalId: string;
  level: Strength;
}

export interface DetectionContext {
  doc: SourceDocument;
  stats: TextStats;
}

export interface DetectorResult {
  signals: Signal[];
  highlights: Highlight[];
}

export interface SignalDetector {
  readonly name: string;
  detect(ctx: DetectionContext): DetectorResult;
}

export const NO_SIGNAL: DetectorResult = { signals: [], highlights: [] };
