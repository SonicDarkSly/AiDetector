import { Injectable } from '@nestjs/common';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { REPORTS_DIR } from '../../../shared/config/paths.js';
import { Analysis, type AnalysisSnapshot, type AnalysisSummary } from '../../domain/analysis.js';
import type { AnalysisRepository } from '../../domain/analysis.repository.js';

const MAX_ENTRIES = 200;
const ID_RE = /^[0-9a-f-]{36}$/;

@Injectable()
export class FileAnalysisRepository implements AnalysisRepository {
  private index: AnalysisSummary[] | null = null;

  async save(analysis: Analysis): Promise<void> {
    await mkdir(REPORTS_DIR, { recursive: true });
    await writeFile(this.path(analysis.id), JSON.stringify(analysis.snapshot()), 'utf8');
    const history = await this.history();
    this.index = [analysis.summary(), ...history.filter((s) => s.id !== analysis.id)];
    for (const old of this.index.splice(MAX_ENTRIES)) await this.delete(old.id);
  }

  async findById(id: string): Promise<Analysis | null> {
    if (!ID_RE.test(id)) return null;
    try {
      return Analysis.restore(JSON.parse(await readFile(this.path(id), 'utf8')) as AnalysisSnapshot);
    } catch {
      return null;
    }
  }

  async history(): Promise<AnalysisSummary[]> {
    if (this.index) return this.index;
    await mkdir(REPORTS_DIR, { recursive: true });
    const summaries: AnalysisSummary[] = [];
    for (const file of (await readdir(REPORTS_DIR)).filter((f) => f.endsWith('.json'))) {
      const analysis = await this.findById(file.slice(0, -5));
      if (analysis) summaries.push(analysis.summary());
    }
    this.index = summaries.sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt));
    return this.index;
  }

  async delete(id: string): Promise<void> {
    if (!ID_RE.test(id)) return;
    await rm(this.path(id), { force: true });
    this.index = this.index?.filter((s) => s.id !== id) ?? null;
  }

  async clear(): Promise<void> {
    for (const s of await this.history()) await rm(this.path(s.id), { force: true });
    this.index = [];
  }

  private path(id: string): string {
    return join(REPORTS_DIR, `${id}.json`);
  }
}
