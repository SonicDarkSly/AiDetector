import type {
  DetectionContext,
  DetectorResult,
  Highlight,
  Signal,
  SignalDetector,
} from '../signal/signal.js';
import { excerpt } from './text-scan.js';

function collect(text: string, re: RegExp, signalId: string, level: Signal['strength']) {
  const hl: Highlight[] = [];
  const ev: string[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    hl.push({ start: m.index, end: m.index + m[0].length, signalId, level });
    if (ev.length < 4) ev.push(excerpt(text, m.index, m.index + m[0].length, 25));
  }
  return { count: hl.length, highlights: hl, evidence: ev };
}

export class UnicodeDetector implements SignalDetector {
  readonly name = 'unicode';

  detect({ doc, stats }: DetectionContext): DetectorResult {
    const text = doc.text;
    const signals: Signal[] = [];
    const highlights: Highlight[] = [];

    const pua = collect(text, /[\uE200-\uE2FF]/g, 'uni-oai-pua', 'fort');
    if (pua.count > 0) {
      highlights.push(...pua.highlights);
      signals.push({
        id: 'uni-oai-pua',
        category: 'unicode',
        label: 'Caractères privés de citation ChatGPT (U+E200…)',
        detail:
          "Caractères de la « zone privée » Unicode qu'utilise ChatGPT pour délimiter ses citations de sources. Invisibles à l'écran, ils survivent au copier-coller : signature quasi certaine.",
        strength: 'fort',
        direction: 'ia',
        points: 40,
        vendors: [{ vendor: 'chatgpt', weight: 3 }],
        evidence: pua.evidence,
        count: pua.count,
      });
    }

    const zw = collect(text, /[\u200B\u200C\u200D\u2060\u180E]|(?<!^)\uFEFF/g, 'uni-zero-width', 'moyen');

    const zwFiltered = zw.highlights.filter((h) => {
      if (text[h.start] !== '\u200D') return true;
      const prev = text.charCodeAt(h.start - 1);
      const isEmojiTail =
        (prev >= 0xdc00 && prev <= 0xdfff) || prev === 0xfe0f || (prev >= 0x2600 && prev <= 0x27bf);
      return !isEmojiTail;
    });
    if (zwFiltered.length > 0) {
      highlights.push(...zwFiltered);
      signals.push({
        id: 'uni-zero-width',
        category: 'unicode',
        label: `Caractères invisibles (largeur nulle) : ${zwFiltered.length}`,
        detail:
          'Espaces de largeur nulle (ZWSP, ZWJ, WJ…) : invisibles, jamais tapés au clavier. Certains générateurs en insèrent comme filigrane ; ils proviennent aussi de copier-coller de pages web. Indice sérieux, pas une preuve.',
        strength: 'moyen',
        direction: 'ia',
        points: zwFiltered.length >= 3 ? 18 : 10,
        evidence: zw.evidence,
        count: zwFiltered.length,
      });
    }

    const tagRe = /[\u{E0000}-\u{E007F}]+/gu;
    const tags = collect(text, tagRe, 'uni-tags', 'fort');
    if (tags.count > 0) {
      const hidden = (text.match(tagRe) ?? [])
        .map((run) =>
          [...run].map((c) => String.fromCharCode((c.codePointAt(0) ?? 0xe0000) - 0xe0000)).join(''),
        )
        .filter((s) => s.trim())
        .slice(0, 3);
      highlights.push(...tags.highlights);
      signals.push({
        id: 'uni-tags',
        category: 'unicode',
        label: 'Message caché en caractères « tags » Unicode',
        detail:
          "Suite de caractères invisibles qui encodent du texte ASCII caché (technique de filigrane ou d'injection d'instructions). Message décodé ci-dessous.",
        strength: 'fort',
        direction: 'ia',
        points: 25,
        evidence: hidden.length ? hidden.map((h) => `Texte caché : « ${h.slice(0, 120)} »`) : tags.evidence,
        count: tags.count,
      });
    }

    const vs = collect(
      text,
      /(?<![\p{Extended_Pictographic}⃣#*0-9©®™])[\uFE00-\uFE0F]|[\u{E0100}-\u{E01EF}]/gu,
      'uni-vs',
      'moyen',
    );
    if (vs.count > 0) {
      highlights.push(...vs.highlights);
      signals.push({
        id: 'uni-vs',
        category: 'unicode',
        label: 'Sélecteurs de variante isolés',
        detail:
          'Caractères invisibles normalement réservés aux émojis, ici seuls : technique connue pour cacher des données (filigrane) dans un texte.',
        strength: 'moyen',
        direction: 'ia',
        points: 15,
        evidence: vs.evidence,
        count: vs.count,
      });
    }

    const nnbsp = collect(text, /\u202F/g, 'uni-nnbsp', 'moyen');
    const suspicious = nnbsp.highlights.filter((h) => {
      if (stats.language !== 'fr') return true;
      const next = text[h.end] ?? '';
      const prev = text[h.start - 1] ?? '';
      return !/[;:!?»%€$\d]/.test(next) && prev !== '«' && !/\d/.test(prev);
    });
    if (suspicious.length >= 2) {
      highlights.push(...suspicious);
      signals.push({
        id: 'uni-nnbsp',
        category: 'unicode',
        label: `Espaces fines insécables inhabituelles : ${suspicious.length}`,
        detail:
          "Espace U+202F à des endroits où la typographie ne l'emploie pas. Repérée dans des sorties de modèles OpenAI récents ; aussi produite par certains logiciels de mise en page.",
        strength: 'moyen',
        direction: 'ia',
        points: 12,
        vendors: [{ vendor: 'chatgpt', weight: 1 }],
        evidence: suspicious.slice(0, 4).map((h) => excerpt(text, h.start, h.end, 25)),
        count: suspicious.length,
      });
    }

    const homo: Highlight[] = [];
    const homoEv: string[] = [];
    const wordRe = /\p{L}+/gu;
    let m: RegExpExecArray | null;
    while ((m = wordRe.exec(text)) !== null) {
      const w = m[0];
      if (/\p{Script=Latin}/u.test(w) && /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(w)) {
        homo.push({ start: m.index, end: m.index + w.length, signalId: 'uni-homoglyph', level: 'moyen' });
        if (homoEv.length < 4) homoEv.push(w);
      }
    }
    if (homo.length > 0) {
      highlights.push(...homo);
      signals.push({
        id: 'uni-homoglyph',
        category: 'unicode',
        label: `Lettres déguisées (homoglyphes) : ${homo.length} mot(s)`,
        detail:
          "Mots latins contenant des lettres cyrilliques ou grecques identiques à l'œil (а/a, е/e, о/o…). Technique typique des outils « humanizer » qui maquillent un texte d'IA pour tromper les détecteurs.",
        strength: homo.length >= 3 ? 'fort' : 'moyen',
        direction: 'ia',
        points: homo.length >= 3 ? 30 : 15,
        evidence: homoEv,
        count: homo.length,
      });
    }

    const bidi = collect(text, /[\u202A-\u202E\u2066-\u2069]/g, 'uni-bidi', 'faible');
    if (bidi.count > 0) {
      highlights.push(...bidi.highlights);
      signals.push({
        id: 'uni-bidi',
        category: 'unicode',
        label: 'Caractères de contrôle de direction du texte',
        detail:
          "Caractères invisibles qui inversent le sens d'écriture : inhabituels dans un texte français/anglais (copie d'une interface, ou manipulation).",
        strength: 'faible',
        direction: 'neutre',
        points: 4,
        count: bidi.count,
      });
    }
    return { signals, highlights };
  }
}
