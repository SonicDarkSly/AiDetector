import type { TextDomain } from '../text/genre.js';
import type { Calibration } from './calibration.js';
import type { Sample } from './recalibration.js';

export type AnswerLabel = 'ai' | 'human';

export interface Answer {
  label: AnswerLabel;
  vendor: string | null;
  tokens: number;
  meanLogProb: number;
  domain: TextDomain;
  at: string;
}

export interface CalibrationStore {
  baseSamples(): Promise<Sample[]>;
  answers(): Promise<Record<string, Answer>>;
  saveAnswers(answers: Record<string, Answer>): Promise<void>;
  saved(): Promise<Calibration | null>;
  save(calibration: Calibration | null): Promise<void>;
}

export const CALIBRATION_STORE = Symbol('CALIBRATION_STORE');
