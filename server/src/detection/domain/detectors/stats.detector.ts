import type { DetectionContext, DetectorResult, Signal, SignalDetector } from '../signal/signal.js';
import { coefficientOfVariation, paragraphs, words } from '../text/text-stats.js';

export class StatsDetector implements SignalDetector {
  readonly name = 'stats';

  detect({ doc, stats }: DetectionContext): DetectorResult {
    const signals: Signal[] = [];
    if (doc.kind === 'code' || stats.words < 120 || stats.sentences < 8) {
      if (doc.kind !== 'code' && stats.words > 0) {
        signals.push({
          id: 'stat-too-short',
          category: 'stats',
          label: 'Texte trop court pour les statistiques',
          detail: `${stats.words} mots / ${stats.sentences} phrases : en dessous de 120 mots et 8 phrases, le rythme n'est pas mesurable de façon fiable.`,
          strength: 'info',
          direction: 'neutre',
          points: 0,
        });
      }
      return { signals, highlights: [] };
    }

    const cv = stats.sentenceLengthCv;
    if (cv < 0.35) {
      signals.push({
        id: 'stat-burstiness',
        category: 'stats',
        label: 'Phrases de longueur très régulière',
        detail: `Variation de longueur des phrases : ${cv} (moyenne ${stats.avgSentenceLength} mots). Les textes humains dépassent généralement 0,5 ; les textes générés tournent souvent autour de 0,3-0,45.`,
        strength: 'faible',
        direction: 'ia',
        points: 10,
      });
    } else if (cv < 0.45) {
      signals.push({
        id: 'stat-burstiness',
        category: 'stats',
        label: 'Rythme de phrases assez régulier',
        detail: `Variation de longueur des phrases : ${cv} (moyenne ${stats.avgSentenceLength} mots). Zone grise entre écriture humaine soignée et texte généré.`,
        strength: 'faible',
        direction: 'ia',
        points: 4,
      });
    } else if (cv > 0.7) {
      signals.push({
        id: 'stat-burstiness',
        category: 'stats',
        label: 'Rythme de phrases très varié',
        detail: `Variation de longueur des phrases : ${cv}. Alternance marquée de phrases courtes et longues, caractéristique de l'écriture humaine.`,
        strength: 'faible',
        direction: 'humain',
        points: -8,
      });
    }

    const paras = paragraphs(doc.text)
      .map((p) => words(p).length)
      .filter((n) => n >= 15);
    if (paras.length >= 4) {
      const pcv = coefficientOfVariation(paras);
      if (pcv < 0.25) {
        signals.push({
          id: 'stat-paragraphs',
          category: 'stats',
          label: 'Paragraphes de taille très homogène',
          detail: `${paras.length} paragraphes, variation ${pcv.toFixed(2)} : blocs calibrés, typique d'un texte généré (ou très normé).`,
          strength: 'faible',
          direction: 'ia',
          points: 6,
        });
      }
    }

    if (doc.kind !== 'md' && stats.bulletLineRatio > 0.4) {
      signals.push({
        id: 'stat-bullets',
        category: 'stats',
        label: `Texte majoritairement en listes (${Math.round(stats.bulletLineRatio * 100)} % des lignes)`,
        detail: 'Structuration systématique en puces, réflexe des chatbots. Normal pour des notes ou un CV.',
        strength: 'faible',
        direction: 'ia',
        points: 5,
      });
    }
    return { signals, highlights: [] };
  }
}
