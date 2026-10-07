import { Analysis } from './analysis.js';
import type { SourceDocument } from './document/source-document.js';
import type { LanguageModelUsage, LikelihoodScorer } from './likelihood/likelihood-scorer.js';
import { aiProbability, likelihoodSignal, measuredAt, reliability } from './likelihood/likelihood.policy.js';
import type { Highlight, Signal, SignalDetector } from './signal/signal.js';
import { cleanText } from './text/text-cleaner.js';
import { proseRatio, proseSample } from './text/prose-sample.js';
import { looksLikeVerse, type TextDomain } from './text/genre.js';
import { computeStats } from './text/text-stats.js';
import { evaluate, type ModelEstimate } from './verdict/verdict.policy.js';
import { evaluateOrigins } from './origin/origin.policy.js';
import { identifySoftware } from './origin/software.js';

// en dessous, document technique hors du domaine de calibration
const TECHNICAL_PROSE_RATIO = 0.75;

const MAX_ANALYZED_CHARS = 400_000;
const MAX_DISPLAY_CHARS = 60_000;

const CATEGORY_ORDER: Signal['category'][] = [
  'project',
  'metadata',
  'artefact',
  'unicode',
  'model',
  'code',
  'style',
  'stats',
  'watermark',
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
    let languageModel: LanguageModelUsage | null = this.scorer
      ? { name: this.scorer.modelName(), status: 'skipped' }
      : null;
    if (this.scorer && doc.kind !== 'code' && stats.words >= 5) {
      const isDocument = doc.kind === 'pdf' || doc.kind === 'docx';
      const domain: TextDomain = looksLikeVerse(doc.text)
        ? 'verse'
        : isDocument && proseRatio(doc.text) < TECHNICAL_PROSE_RATIO
          ? 'technical'
          : 'prose';
      const sample = isDocument && domain !== 'verse' ? proseSample(doc.text) : doc.text;
      const measure = await this.scorer.measure(sample);
      if (measure) {
        const probability = aiProbability(measure);
        const r = reliability(measure.tokens);
        signals.push(likelihoodSignal(measure, domain));
        model = {
          probability,
          // un poème peu prévisible ne dit rien : la mesure ne doit pas peser comme sur de la prose
          reliability: domain === 'verse' && probability < 0.5 ? Math.min(r, 0.4) : r,
          domain,
        };
        languageModel = {
          name: measure.model,
          status: 'used',
          tokens: measure.tokens,
          elapsedMs: measure.elapsedMs,
          domain,
          meanLogProb: measure.meanLogProb,
          meanEntropy: measure.meanEntropy,
          criterion: measure.criterion,
          rate: measuredAt(measure.tokens),
        };
      } else {
        signals.push(this.unavailable());
        const status = this.scorer.status();
        languageModel = {
          name: this.scorer.modelName(),
          status: status === 'ready' || status === 'idle' ? 'too-short' : status,
        };
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
    const verdict = evaluate(signals, stats, model, doc.kind !== 'code');
    const software = doc.kind === 'pdf' || doc.kind === 'docx' ? identifySoftware(doc.raw) : [];
    return Analysis.complete(
      {
        source: { kind: doc.kind, filename: doc.filename, mimetype: doc.mimetype, size: input.size },
        ...verdict,
        languageModel,
        origins: evaluateOrigins(signals, software, verdict.undetermined ? null : verdict.score / 100),
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
          ? "Le modèle n'est pas encore téléchargé : relancez l'application avec le lanceur pour le récupérer (environ 2 Go, une seule fois)."
          : status === 'disabled'
            ? 'Analyse par modèle désactivée (MEFIANCE_MODEL=off).'
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
