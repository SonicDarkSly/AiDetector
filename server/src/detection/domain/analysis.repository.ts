import type { Analysis, AnalysisSummary } from './analysis.js';

export interface AnalysisRepository {
  save(analysis: Analysis): Promise<void>;
  findById(id: string): Promise<Analysis | null>;
  history(): Promise<AnalysisSummary[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export const ANALYSIS_REPOSITORY = Symbol('ANALYSIS_REPOSITORY');
