import { AggregateRoot } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import type { DocKind, MetaEntry } from './document/source-document.js';
import { AnalysisCompletedEvent } from './events/analysis-completed.event.js';
import type { OriginScore } from './origin/origin.policy.js';
import type { Highlight, Signal } from './signal/signal.js';
import type { TextStats } from './text/text-stats.js';
import type { Verdict } from './verdict/verdict.policy.js';

export interface AnalysisSnapshot extends Verdict {
  id: string;
  analyzedAt: string;
  source: { kind: DocKind; filename: string | null; mimetype: string | null; size: number };
  origins: OriginScore[];
  signals: Signal[];
  metadata: MetaEntry[];
  stats: TextStats;
  text: string;
  textTruncated: boolean;
  highlights: Highlight[];
  cleaned: { text: string; removed: number } | null;
}

export interface AnalysisSummary {
  id: string;
  analyzedAt: string;
  kind: DocKind;
  filename: string | null;
  score: number;
  verdict: string;
  undetermined: boolean;
  topVendor: string | null;
  excerpt: string;
}

export class Analysis extends AggregateRoot {
  private constructor(private readonly state: AnalysisSnapshot) {
    super();
  }

  static complete(data: Omit<AnalysisSnapshot, 'id' | 'analyzedAt'>, origin: string): Analysis {
    const analysis = new Analysis({ id: randomUUID(), analyzedAt: new Date().toISOString(), ...data });
    analysis.apply(
      new AnalysisCompletedEvent(
        analysis.id,
        origin,
        analysis.label,
        data.score,
        data.verdict,
        data.undetermined,
        data.vendors.find((v) => v.level === 'trace')?.label ?? null,
      ),
    );
    return analysis;
  }

  static restore(snapshot: AnalysisSnapshot): Analysis {
    return new Analysis(snapshot);
  }

  get id(): string {
    return this.state.id;
  }

  get label(): string {
    return this.state.source.filename
      ? `« ${this.state.source.filename} »`
      : `texte collé (${this.state.stats.words} mots)`;
  }

  snapshot(): AnalysisSnapshot {
    return this.state;
  }

  summary(): AnalysisSummary {
    const s = this.state;
    return {
      id: s.id,
      analyzedAt: s.analyzedAt,
      kind: s.source.kind,
      filename: s.source.filename,
      score: s.score,
      verdict: s.verdict,
      undetermined: s.undetermined === true,
      topVendor: s.vendors.find((v) => v.level === 'trace')?.label ?? null,
      excerpt: s.text.slice(0, 140).replace(/\s+/g, ' ').trim(),
    };
  }
}
