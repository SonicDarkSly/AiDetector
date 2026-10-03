import type {
  DetectionContext,
  DetectorResult,
  Highlight,
  Signal,
  SignalDetector,
} from '../signal/signal.js';
import { scan } from './text-scan.js';

const W = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, 'giu');

const LEXICON_FR = W(
  [
    "il est (?:important|essentiel|crucial|primordial|fondamental|utile) de (?:noter|souligner|comprendre|rappeler|garder à l['’]esprit|reconnaître)",
    'il convient de (?:noter|souligner|rappeler|mentionner)',
    'dans un monde en (?:constante|perpétuelle|pleine) (?:évolution|mutation)',
    'en (?:constante|perpétuelle) évolution',
    "à l['’]ère (?:du numérique|de l['’]intelligence artificielle|digitale|moderne|actuelle)",
    'dans le paysage (?:actuel|numérique|économique|professionnel|technologique)',
    'plong(?:er|eons|ez|eant) (?:dans|au cœur)',
    "naviguer (?:dans|à travers|entre) (?:les|la|le|ce|cet|cette|l['’])",
    'véritables? (?:levier|atout|pilier|moteur|catalyseur|tremplin|trésor|joyau|vecteur)s?',
    'un atout (?:majeur|précieux|indéniable|incontournable|considérable)',
    'jou(?:e|ent|ant) un rôle (?:clé|crucial|essentiel|central|déterminant|majeur|primordial|fondamental)',
    'incontournables?',
    'cruci(?:al|ale|aux|ales)',
    'primordiale?s?',
    'témoign(?:e|ent|ant) d[eu]',
    'riches? et (?:variée?s?|diversifiée?s?)',
    'synergies?',
    'holistiques?',
    'leviers?',
    'en (?:somme|résumé|définitive|conclusion)',
    'pour (?:conclure|résumer)',
    '(?:de plus|en outre|par ailleurs),',
    'au cœur (?:de|des|du)',
    'mett(?:re|ant|ent) en (?:lumière|avant|exergue)',
    "soulign(?:e|ent|ant) l['’]importance",
    'que vous soyez',
    'que ce soit pour',
    '(?:découvrons|explorons|voyons ensemble)',
    'dans cet article,? (?:nous|je) (?:allons|verrons|vous)',
    'points? clés?',
    'à retenir',
    'tisse(?:r|nt)? (?:des|un|une|les)',
    'tapisserie',
    'foisonnante?s?',
    'pierre angulaire',
    '(?:un|une) approche (?:holistique|globale|intégrée|proactive)',
    'fort(?:e)? de (?:mon|ma|mes) (?:expérience|parcours|compétences)',
    "c['’]est avec (?:un (?:grand|vif|réel) (?:intérêt|enthousiasme)|enthousiasme)",
    'je suis convaincue? que (?:mon|ma|mes)',
    'force de proposition',
    'valeur ajoutée',
    'en (?:perpétuel|plein) essor',
    'optimale?s?',
    'fluidifier',
    'booster',
  ].join('|'),
);

const LEXICON_EN = W(
  [
    'delv(?:e|es|ed|ing)',
    'tapestry',
    'testament to',
    'intricate(?:ly)?',
    'meticulous(?:ly)?',
    'pivotal',
    'underscor(?:e|es|ed|ing)',
    'showcas(?:e|es|ed|ing)',
    'realm',
    'ever-evolving',
    '(?:evolving|digital|modern|competitive) landscape',
    'navigat(?:e|ing) the (?:complexities|challenges|world|landscape)',
    'embark(?:s|ed|ing)? on',
    'foster(?:s|ed|ing)?',
    'leverag(?:e|es|ed|ing)',
    'seamless(?:ly)?',
    'elevat(?:e|es|ed|ing)',
    'harness(?:es|ed|ing)?',
    'multifaceted',
    'nuanced',
    'paramount',
    'holistic',
    'synerg(?:y|ies)',
    "in today['’]s (?:fast-paced|digital|ever|modern|rapidly)",
    "it(?:['’]s| is) (?:important|worth|crucial|essential) (?:to note|noting|to remember|to consider)",
    'in (?:conclusion|summary)',
    '(?:furthermore|moreover|additionally),',
    'play(?:s|ed|ing)? a (?:crucial|pivotal|vital|key|significant) role',
    'sh(?:ed|eds|edding) light on',
    'stands? as a',
    'boasts?',
    'nestled',
    'vibrant',
    'bustling',
    'game[- ]changer',
    "(?:let['’]s )?dive (?:into|deeper)",
    'a rich (?:tapestry|history|heritage)',
    'commendable',
    'noteworthy',
    'invaluable',
    'unwavering',
    'cutting-edge',
    'robust',
    'crucial',
  ].join('|'),
);

const NOT_X_BUT_Y_FR =
  /(?<![\p{L}])(?:ce n['’]est pas|il ne s['’]agit pas) (?:seulement|simplement|juste|qu['’]une?) [^.!?\n]{1,80}|non seulement [^.!?\n]{1,100} mais|pas seulement [^.!?\n]{1,60},? mais/giu;
const NOT_X_BUT_Y_EN =
  /(?:it['’]?s|this is|that['’]?s) not (?:just|only|merely|simply) [^.!?\n]{1,60}[,;\u2014\u2013-]\s*(?:it['’]?s|but)|not only [^.!?\n]{1,100} but(?: also)?/gi;

const TRANSITION_START =
  /^(?:De plus|En outre|Par ailleurs|Ainsi|Enfin|En effet|En somme|En résumé|En conclusion|Furthermore|Moreover|Additionally|In addition|Overall|Ultimately|In conclusion)\b/u;

const LABEL_LIST = /^\s*(?:[-*•▪]|\d{1,2}[.)])\s*\*{0,2}\p{Lu}[^:\n]{1,50}?\*{0,2}\s?:\s+\S/gmu;

const CASUAL_FR =
  /(?<![\p{L}])(?:mdr|ptdr|lol|jsp|tkt|stp|bcp|pk|pcq|jpp|osef|wesh|chui|chuis|ouais|trkl|dsl|jsuis|j['’]sais|y['’]a|slt|bjr|cc|ahah+|haha+|hihi|xd|svp)(?![\p{L}])/giu;
const CASUAL_EN =
  /(?<![\p{L}])(?:lol|lmao|idk|tbh|imo|imho|gonna|wanna|kinda|gotta|omg|btw|u|ur|thx|pls)(?![\p{L}])/giu;

export class StyleDetector implements SignalDetector {
  readonly name = 'style';

  detect({ doc, stats }: DetectionContext): DetectorResult {
    if (doc.kind === 'code' || stats.words < 25) return { signals: [], highlights: [] };
    const text = doc.text;
    const signals: Signal[] = [];
    const highlights: Highlight[] = [];
    const fr = stats.language !== 'en';

    const lex = scan(text, fr ? LEXICON_FR : LEXICON_EN, 'sty-lexicon', 'faible', 8, false);
    const density = (lex.count * 1000) / Math.max(stats.words, 1);
    const d = lex.distinct.size;
    let lexSignal: Pick<Signal, 'strength' | 'points'> | null = null;
    if (d >= 6 && density >= 8) lexSignal = { strength: 'moyen', points: 22 };
    else if (d >= 4 && density >= 5) lexSignal = { strength: 'faible', points: 14 };
    else if (d >= 2) lexSignal = { strength: 'faible', points: 6 };
    else if (d === 1) lexSignal = { strength: 'info', points: 2 };
    if (lexSignal) {
      highlights.push(...lex.highlights.map((h) => ({ ...h, level: lexSignal!.strength })));
      signals.push({
        id: 'sty-lexicon',
        category: 'style',
        label: `Vocabulaire typique des IA : ${d} expression(s) distincte(s)`,
        detail: `${lex.count} occurrence(s), soit ${density.toFixed(1)} pour 1000 mots. Expressions sur-représentées dans les textes de modèles de langage (${fr ? '« il est important de noter », « joue un rôle crucial », « incontournable »…' : '« delve », « tapestry », « it is important to note »…'}). Un humain peut les employer : seule une forte densité est parlante.`,
        strength: lexSignal.strength,
        direction: 'ia',
        points: lexSignal.points,
        evidence: [...lex.distinct].slice(0, 10),
        count: lex.count,
      });
    } else if (stats.words >= 300) {
      signals.push({
        id: 'sty-no-lexicon',
        category: 'style',
        label: 'Aucune tournure typique des IA',
        detail:
          "Sur un texte de cette longueur, l'absence totale de ces expressions est plutôt humaine (ou d'une IA bien « briefée »).",
        strength: 'faible',
        direction: 'humain',
        points: -4,
      });
    }

    const nxby = scan(text, fr ? NOT_X_BUT_Y_FR : NOT_X_BUT_Y_EN, 'sty-not-x', 'faible', 4);
    if (nxby.count >= 2 || (nxby.count === 1 && stats.words < 300)) {
      highlights.push(...nxby.highlights);
      signals.push({
        id: 'sty-not-x',
        category: 'style',
        label: "« Ce n'est pas seulement X, c'est Y »",
        detail:
          "Construction rhétorique d'opposition, tic d'écriture très marqué de ChatGPT (et repris par d'autres modèles).",
        strength: 'faible',
        direction: 'ia',
        points: 8,
        evidence: nxby.evidence,
        count: nxby.count,
      });
    }

    const sents = text
      .split(/(?<=[.!?…])\s+|\n+/u)
      .map((s) => s.trim())
      .filter(Boolean);
    const trans = sents.filter((s) => TRANSITION_START.test(s));
    if (sents.length >= 8 && trans.length / sents.length >= 0.15 && trans.length >= 3) {
      signals.push({
        id: 'sty-transitions',
        category: 'style',
        label: `Connecteurs en début de phrase : ${Math.round((trans.length / sents.length) * 100)} %`,
        detail: 'Enchaînement scolaire « De plus… En outre… Enfin… » très fréquent dans les textes générés.',
        strength: 'faible',
        direction: 'ia',
        points: 8,
        evidence: trans.slice(0, 4).map((s) => s.slice(0, 80)),
        count: trans.length,
      });
    }

    if (doc.kind !== 'md') {
      const lists = scan(text, LABEL_LIST, 'sty-label-list', 'faible', 4);
      if (lists.count >= 3) {
        highlights.push(...lists.highlights);
        signals.push({
          id: 'sty-label-list',
          category: 'style',
          label: `Listes « Intitulé : explication » (${lists.count})`,
          detail:
            'Puces commençant par un intitulé (souvent en gras) suivi de deux-points : gabarit de présentation favori des chatbots.',
          strength: 'faible',
          direction: 'ia',
          points: 8,
          evidence: lists.evidence,
          count: lists.count,
        });
      }
    }

    const emCount = (text.match(/\u2014/g) ?? []).length;
    if (stats.emDashPer1000 >= 4 && emCount >= 3) {
      highlights.push(...scan(text, /\u2014/g, 'sty-emdash', 'faible', 0).highlights);
      signals.push({
        id: 'sty-emdash',
        category: 'style',
        label: `Tirets cadratins fréquents (${emCount})`,
        detail: `${stats.emDashPer1000} pour 1000 mots. Ce tiret n'existe pas sur un clavier AZERTY/QWERTZ (il faut un raccourci) ; les assistants en abusent (ChatGPT en tête). Les correcteurs (Word, macOS) en insèrent parfois.`,
        strength: 'faible',
        direction: 'ia',
        points: 10,
        count: emCount,
      });
    }

    const casual = scan(text, fr ? CASUAL_FR : CASUAL_EN, 'sty-casual', 'faible', 5, false);
    if (casual.count >= 2) {
      highlights.push(...casual.highlights);
      signals.push({
        id: 'sty-casual',
        category: 'style',
        label: 'Langage familier / abréviations SMS',
        detail:
          "Abréviations et tics oraux (« mdr », « jsp », « ouais »…) que les IA n'emploient pas spontanément.",
        strength: 'faible',
        direction: 'humain',
        points: -10,
        evidence: [...casual.distinct].slice(0, 8),
        count: casual.count,
      });
    }

    const punct = scan(text, /[!?]{2,}|\.{4,}/g, 'sty-punct', 'faible', 4);
    if (punct.count >= 2) {
      signals.push({
        id: 'sty-punct',
        category: 'style',
        label: 'Ponctuation expressive (!!, ???, ....)',
        detail: 'Ponctuation répétée, rare dans un texte généré.',
        strength: 'faible',
        direction: 'humain',
        points: -5,
        evidence: punct.evidence,
        count: punct.count,
      });
    }

    const lower = (text.match(/[.!?]\s+[a-zàâçéèêëîïôûùüÿœ]/g) ?? []).length;
    const doubleSpaces = doc.kind === 'pdf' ? 0 : (text.match(/\S {2,}(?=\S)/g) ?? []).length;
    if ((lower >= 3 && lower / Math.max(stats.sentences, 1) > 0.1) || doubleSpaces >= 3) {
      signals.push({
        id: 'sty-sloppy',
        category: 'style',
        label: 'Négligences de saisie',
        detail: `${lower} phrase(s) commençant par une minuscule, ${doubleSpaces} double(s) espace(s). Les IA produisent un texte typographiquement propre.`,
        strength: 'faible',
        direction: 'humain',
        points: -6,
      });
    }
    return { signals, highlights };
  }
}
