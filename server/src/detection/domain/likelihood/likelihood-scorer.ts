export interface LikelihoodMeasure {
  model: string;
  tokens: number;
  meanLogProb: number;
  meanEntropy: number;
  criterion: number;
  // score Binoculars (bas = IA) ; absent si le modèle de base n'est pas disponible
  binoculars?: number;
  elapsedMs: number;
}

export interface LikelihoodScorer {
  measure(text: string): Promise<LikelihoodMeasure | null>;
  status(): LikelihoodStatus;
  modelName(): string | null;
  describe(): Promise<LanguageModelInfo>;
  activity(): ModelActivity | null;
}

export interface ModelActivity {
  phase: 'loading' | 'observing' | 'measuring';
  model: string;
  tokens: number | null;
  since: number;
  step: number;
  steps: number;
  models: ActiveModel[];
  gpu: string | null;
}

export interface ActiveModel {
  name: string;
  role: 'performer' | 'observer';
  sizeBytes: number | null;
  // avancement de l'étape en cours pour ce modèle, de 0 à 1
  progress: number;
}

export interface LanguageModelInfo {
  name: string | null;
  status: LikelihoodStatus;
  parameters: string | null;
  quantization: string | null;
  sizeBytes: number | null;
  maxTokens: number;
  minTokens: number;
  contextSize: number;
}

export interface LanguageModelUsage {
  name: string | null;
  status: 'used' | 'too-short' | 'skipped' | LikelihoodStatus;
  tokens?: number;
  elapsedMs?: number;
  domain?: 'prose' | 'technical' | 'verse';
  meanLogProb?: number;
  meanEntropy?: number;
  criterion?: number;
  binoculars?: number;
  rate?: { tokens: number; detected: number; falsePositives: number };
}

export type LikelihoodStatus = 'ready' | 'idle' | 'missing' | 'disabled' | 'error';

export const LIKELIHOOD_SCORER = Symbol('LIKELIHOOD_SCORER');
