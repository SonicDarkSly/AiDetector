import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ANSWERS_FILE, CALIBRATION_FILE, CALIBRATION_SAMPLES_FILE } from '../../../shared/config/paths.js';
import { useCalibration, type Calibration } from '../../domain/likelihood/calibration.js';
import type { Answer, CalibrationStore } from '../../domain/likelihood/calibration.store.js';
import type { Sample } from '../../domain/likelihood/recalibration.js';

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 1), 'utf8');
  await rename(`${path}.tmp`, path);
}

@Injectable()
export class FileCalibrationStore implements CalibrationStore, OnModuleInit {
  private readonly logger = new Logger('Calibration');
  private base: Sample[] | null = null;

  async onModuleInit(): Promise<void> {
    const saved = await this.saved();
    useCalibration(saved);
    if (saved) this.logger.log(`calibration personnalisée active (${saved.answers} réponses)`);
  }

  async baseSamples(): Promise<Sample[]> {
    if (!this.base) {
      const file = await readJson<{ rows: [number, number, number, number][] }>(CALIBRATION_SAMPLES_FILE);
      this.base = (file?.rows ?? []).map(([group, ai, tokens, meanLogProb]) => ({
        group,
        ai: ai === 1,
        tokens,
        meanLogProb,
        weight: 1,
      }));
    }
    return this.base;
  }

  async answers(): Promise<Record<string, Answer>> {
    return (await readJson<Record<string, Answer>>(ANSWERS_FILE)) ?? {};
  }

  saveAnswers(answers: Record<string, Answer>): Promise<void> {
    return writeJson(ANSWERS_FILE, answers);
  }

  saved(): Promise<Calibration | null> {
    return readJson<Calibration>(CALIBRATION_FILE);
  }

  async save(calibration: Calibration | null): Promise<void> {
    if (calibration) await writeJson(CALIBRATION_FILE, calibration);
    else await writeFile(CALIBRATION_FILE, 'null', 'utf8').catch(() => undefined);
    useCalibration(calibration);
  }
}
