export interface LikelihoodMeasure {
  model: string;
  tokens: number;
  meanLogProb: number;
  meanEntropy: number;
  criterion: number;
  elapsedMs: number;
}

export interface LikelihoodScorer {
  measure(text: string): Promise<LikelihoodMeasure | null>;
  status(): LikelihoodStatus;
  modelName(): string | null;
}

export interface LanguageModelUsage {
  name: string | null;
  status: 'used' | 'too-short' | 'skipped' | LikelihoodStatus;
  tokens?: number;
  elapsedMs?: number;
}

export type LikelihoodStatus = 'ready' | 'idle' | 'missing' | 'disabled' | 'error';

export const LIKELIHOOD_SCORER = Symbol('LIKELIHOOD_SCORER');
