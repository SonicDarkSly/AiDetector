import { Analysis } from './analysis.js';
import type { SourceDocument } from './document/source-document.js';
import type { LikelihoodScorer } from './likelihood/likelihood-scorer.js';
import { aiProbability, likelihoodSignal, reliability } from './likelihood/likelihood.policy.js';
import type { Highlight, Signal, SignalDetector } from './signal/signal.js';
import { cleanText } from './text/text-cleaner.js';
import { computeStats } from './text/text-stats.js';
import { evaluate, type ModelEstimate } from './verdict/verdict.policy.js';

const MAX_ANALYZED_CHARS = 400_000;
const MAX_DISPLAY_CHARS = 60_000;

const CATEGORY_ORDER: Signal['category'][] = [
  'metadata',
  'artefact',
  'unicode',
  'model',
  'code',
  'style',
  'stats',
];
const STRENGTH_ORDER: Signal['strength'][] = ['fort', 'moyen', 'faible', 'info'];

export class Analyzer {
  constructor(
    private readonly detectors: SignalDetector[],
    private readonly scorer: LikelihoodScorer | null = null,
  ) {}

  async analyze(input: SourceDocument, origin: string): Promise<Analysis> {
    const doc =
      input.text.length > MAX_ANALYZED_CHARS
        ? { ...input, text: input.text.slice(0, MAX_ANALYZED_CHARS) }
        : input;
    const stats = computeStats(doc.text);

    const signals: Signal[] = [];
    const highlights: Highlight[] = [];
    for (const detector of this.detectors) {
      const result = detector.detect({ doc, stats });
      signals.push(...result.signals);
      highlights.push(...result.highlights);
    }

    let model: ModelEstimate | null = null;
    if (this.scorer && doc.kind !== 'code' && stats.words >= 5) {
      const measure = await this.scorer.measure(doc.text);
      if (measure) {
        signals.push(likelihoodSignal(measure));
        model = { probability: aiProbability(measure), reliability: reliability(measure.tokens) };
      } else {
        signals.push(this.unavailable());
      }
    }

    signals.sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        STRENGTH_ORDER.indexOf(a.strength) - STRENGTH_ORDER.indexOf(b.strength) ||
        b.points - a.points,
    );

    const metaEvidence = signals
      .filter((s) => s.category === 'metadata' && s.direction === 'ia')
      .flatMap((s) => s.evidence ?? []);
    const metadata = doc.metadata.map((m) => ({
      ...m,
      flagged: metaEvidence.some((e) => m.value.length >= 3 && e.includes(m.value)),
    }));

    const cleaned = cleanText(doc.text);
    return Analysis.complete(
      {
        source: { kind: doc.kind, filename: doc.filename, mimetype: doc.mimetype, size: input.size },
        ...evaluate(signals, stats, model),
        signals,
        metadata,
        stats,
        text: doc.text.slice(0, MAX_DISPLAY_CHARS),
        textTruncated: input.text.length > MAX_DISPLAY_CHARS,
        highlights: disjoint(highlights.filter((h) => h.start < MAX_DISPLAY_CHARS)),
        cleaned: cleaned.removed > 0 ? cleaned : null,
      },
      origin,
    );
  }

  private unavailable(): Signal {
    const status = this.scorer?.status();
    return {
      id: 'model-unavailable',
      category: 'model',
      label: 'Modèle de langage indisponible',
      detail:
        status === 'missing'
          ? "Le modèle n'est pas encore téléchargé : relancez l'application avec le lanceur pour le récupérer (environ 1 Go, une seule fois)."
          : status === 'disabled'
            ? 'Analyse par modèle désactivée (AIDETECTOR_MODEL=off).'
            : "Le modèle n'a pas pu être chargé : voir server/logs/access.log.",
      strength: 'info',
      direction: 'neutre',
      points: 0,
    };
  }
}

function disjoint(highlights: Highlight[]): Highlight[] {
  const rank = (h: Highlight) => STRENGTH_ORDER.indexOf(h.level);
  const kept: Highlight[] = [];
  for (const h of [...highlights].sort((a, b) => rank(a) - rank(b) || a.start - b.start)) {
    if (!kept.some((k) => h.start < k.end && k.start < h.end)) kept.push(h);
  }
  return kept.sort((a, b) => a.start - b.start);
}
