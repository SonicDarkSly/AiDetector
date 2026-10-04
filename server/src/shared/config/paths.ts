import { join } from 'node:path';

export const SERVER_ROOT = join(__dirname, '..', '..', '..');
export const DATA_DIR = join(SERVER_ROOT, 'data');
export const REPORTS_DIR = join(DATA_DIR, 'reports');
export const LLM_DIR = join(DATA_DIR, 'llm');
export const LLM_MODELS_FILE = join(SERVER_ROOT, 'llm-models.json');
export const CALIBRATION_SAMPLES_FILE = join(SERVER_ROOT, 'calibration-samples.json');
export const ANSWERS_FILE = join(DATA_DIR, 'answers.json');
export const CALIBRATION_FILE = join(DATA_DIR, 'calibration.json');
