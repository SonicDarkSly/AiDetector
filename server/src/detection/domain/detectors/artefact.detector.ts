import type {
  DetectionContext,
  DetectorResult,
  Highlight,
  Signal,
  SignalDetector,
  Strength,
} from '../signal/signal.js';
import { vendorOf, type VendorHint } from '../signal/vendor.js';
import { scan } from './text-scan.js';

interface ArtefactRule {
  id: string;
  re: RegExp;
  label: string;
  detail: string;
  strength: Strength;
  points: number;
  vendors?: VendorHint[];

  min?: number;

  zone?: 'all' | 'head' | 'tail';

  skipKinds?: string[];
}

const RULES: ArtefactRule[] = [
  {
    id: 'art-oaicite',
    re: /:?contentReference\[oaicite:\d+\](\{index=\d+\})?|\boaicite:\d+/g,
    label: 'Marqueur de citation interne de ChatGPT (oaicite)',
    detail:
      "« contentReference[oaicite:…] » est le code interne des sources de ChatGPT. Il apparaît quand on copie une réponse ChatGPT : c'est une signature quasi certaine.",
    strength: 'fort',
    points: 45,
    vendors: [{ vendor: 'chatgpt', weight: 3 }],
  },
  {
    id: 'art-oai-brackets',
    re: /【\d+(?::\d+)?†[^】\n]{0,60}】/g,
    label: 'Citation au format 【n†source】 (ChatGPT)',
    detail:
      'Format de référence aux fichiers/sources propre à ChatGPT (recherche, fichiers joints). Signature quasi certaine.',
    strength: 'fort',
    points: 45,
    vendors: [{ vendor: 'chatgpt', weight: 3 }],
  },
  {
    id: 'art-citeturn',
    re: /\b(?:cite|filecite|navlist)?turn\d+(?:search|news|view|fetch|file|image|academia|forecast|finance|product)\d+\b|\bfilecite\b/g,
    label: 'Code de source interne (citeturn…) de ChatGPT',
    detail:
      'Identifiants « turn0search3 » utilisés par la recherche web de ChatGPT, visibles quand le rendu des sources est perdu au copier-coller.',
    strength: 'fort',
    points: 45,
    vendors: [{ vendor: 'chatgpt', weight: 3 }],
  },
  {
    id: 'art-gemini-cite',
    re: /\[cite_start\]|\[cite:\s*[\d,\s-]+\]/g,
    label: 'Marqueurs [cite_start] / [cite: n] (Gemini)',
    detail:
      'Balises de citation de Gemini (documents joints / recherche) restées dans le texte copié. Signature quasi certaine.',
    strength: 'fort',
    points: 45,
    vendors: [{ vendor: 'gemini', weight: 3 }],
  },
  {
    id: 'art-claude-tags',
    re: /<\/?(?:antml:[a-z_]+|antArtifact|cite index="[^"]*")[^>]*>/g,
    label: 'Balises internes de Claude',
    detail: 'Balises de citation/artefact de Claude restées dans le texte.',
    strength: 'fort',
    points: 40,
    vendors: [{ vendor: 'claude', weight: 3 }],
  },
  {
    id: 'art-self-ai',
    re: /\b(?:as an ai(?: language model)?|as a large language model|i(?: am|'m) an ai\b|my (?:training data|knowledge cut-?off)|i (?:don't|do not) have (?:access to )?(?:real-time|the internet|browsing))|en tant qu['’](?:ia|intelligence artificielle|assistant(?:e)? (?:virtuel|ia))|en tant que modèle de langage|je suis (?:une? )?(?:ia|intelligence artificielle|modèle de langage|assistant virtuel)\b|mes données d['’]entraînement|(?:ma )?date (?:limite|de coupure) (?:de mes |des )?connaissances|je n['’]ai pas accès à (?:internet|des informations en temps réel)/gi,
    label: "L'IA parle d'elle-même dans le texte",
    detail:
      "Phrase où l'assistant se présente comme une IA (« en tant qu'IA… », « mes données d'entraînement… »). Oubli typique lors d'un copier-coller.",
    strength: 'fort',
    points: 40,
  },
  {
    id: 'art-refusal',
    re: /\b(?:i'?m sorry|je suis désolée?),?\s+(?:but\s+)?(?:i can(?:'|no)t|i cannot|je ne peux pas)\s+(?:help|assist|provide|aider|répondre|fournir|générer)/gi,
    label: "Formule de refus d'assistant IA",
    detail: 'Refus standard de chatbot laissé dans le texte.',
    strength: 'fort',
    points: 30,
  },
  {
    id: 'art-opening',
    re: /^\s*(?:(?:bien sûr|absolument|certainement|excellente question|très bonne question|avec plaisir|parfait|super)\s*[!,.]?\s*(?:voici|je vais|ci-dessous|voilà)|voici (?:une?|la|le|les|ta|votre|ton|vos|tes) (?:version|proposition|exemple|liste|résumé|texte|lettre|réponse|réécriture|correction|reformulation|traduction|mail|e-?mail|plan|synthèse)|(?:certainly|sure|absolutely|of course|great question)[!,.]?\s*(?:here(?:'s| is| are)|below)|here(?:'s| is) (?:a|an|the|your) (?:revised|rewritten|polished|improved|draft|version|summary|example|list))/gi,
    label: "Phrase d'introduction de chatbot",
    detail:
      "Le texte commence comme une réponse d'assistant (« Bien sûr ! Voici… », « Voici une version… »).",
    strength: 'moyen',
    points: 22,
    zone: 'head',
  },
  {
    id: 'art-closing',
    re: /n['’]hésite[sz]? pas à (?:me )?(?:demander|dire|faire savoir|revenir vers moi)|j['’]espère que (?:cela|ça|ceci) (?:vous|t['’]) ?(?:aide|aidera|sera utile|conviendra)|(?:souhaite[sz]?|voulez|veux)[- ](?:vous|tu) que je|tu veux que je|dis-moi si tu (?:veux|souhaites|préfères)|dites-moi si vous (?:voulez|souhaitez|préférez)|je peux aussi (?:te|vous) (?:proposer|préparer|faire|rédiger)|si tu (?:le )?veux,? je peux|si vous le souhaitez,? je peux|let me know if (?:you|there)|i hope this helps|feel free to (?:ask|reach out|let me know)|would you like me to|do you want me to|if you(?:'d)? like,? i can|happy to help/gi,
    label: 'Phrase de conclusion / proposition de chatbot',
    detail:
      "Le texte se termine comme une réponse d'assistant (« Souhaitez-vous que je… », « N'hésitez pas à me demander… »). L'offre finale « Veux-tu que je te prépare… ? » est très typique de ChatGPT.",
    strength: 'moyen',
    points: 22,
    zone: 'tail',
    vendors: [{ vendor: 'chatgpt', weight: 1 }],
  },
  {
    id: 'art-placeholders',
    re: /\[(?:votre|vos|ton|ta|tes|nom|prénom|date|adresse|entreprise|société|poste|insérer|insert|your|company|name|recipient|destinataire|numéro|téléphone|email|e-mail|ville|lieu|montant|titre)\b[^\]\n]{0,40}\]/gi,
    label: 'Champs à compléter entre crochets',
    detail:
      "« [Votre nom] », « [Nom de l'entreprise] »… : gabarit typique des lettres et mails générés par IA, laissés tels quels.",
    strength: 'moyen',
    points: 15,
  },
  {
    id: 'art-utm',
    re: /utm_source=(?:chatgpt\.com|openai|perplexity(?:\.ai)?|copilot(?:\.com)?|gemini|claude(?:\.ai)?|bard|you\.com|mistral|deepseek|grok)/gi,
    label: "Lien avec traceur utm_source d'un assistant IA",
    detail:
      "Les liens fournis par ChatGPT (et d'autres) portent « ?utm_source=chatgpt.com ». Le retrouver dans un texte ou un fichier signe une source copiée depuis l'assistant.",
    strength: 'fort',
    points: 45,
  },
  {
    id: 'art-emoji-bullets',
    re: /^[ \t]*(?:✅|❌|🚀|👉|📌|🔹|🔸|✨|💡|⚡|📊|🎯|🔥|🧠|📈|🛠\uFE0F|⚠\uFE0F|📝|🔍|💼|🌟|➡\uFE0F|✔\uFE0F|1\uFE0F⃣|2\uFE0F⃣|3\uFE0F⃣)/gmu,
    label: 'Émojis utilisés comme puces',
    detail:
      'Lignes commençant par ✅ 🚀 👉 📌… : mise en forme très fréquente chez ChatGPT. Indice faible (les humains le font aussi sur LinkedIn).',
    strength: 'faible',
    points: 8,
    min: 3,
    vendors: [{ vendor: 'chatgpt', weight: 1 }],
  },
  {
    id: 'art-latex',
    re: /\\\(|\\\)|\\\[|\\\]|\\frac\{|\\times\b|\\text\{|\\cdot\b|\\approx\b/g,
    label: 'Formules LaTeX brutes',
    detail:
      "Délimiteurs \\( \\) \\[ \\] copiés tels quels : c'est ainsi que les chatbots écrivent les formules avant rendu.",
    strength: 'faible',
    points: 8,
    min: 2,
    skipKinds: ['code', 'md'],
    vendors: [{ vendor: 'chatgpt', weight: 1 }],
  },
];

const MARKDOWN_RE =
  /\*\*[^*\n]{2,80}\*\*|^#{1,4} \S.*$|^\s*(?:---|\*\*\*)\s*$|^```|^\|(?:\s*:?-{3,}:?\s*\|)+\s*$/gm;

const HEAD_CHARS = 300;
const TAIL_CHARS = 600;

export class ArtefactDetector implements SignalDetector {
  readonly name = 'artefact';

  detect({ doc }: DetectionContext): DetectorResult {
    const text = doc.text;
    const signals: Signal[] = [];
    const highlights: Highlight[] = [];

    for (const rule of RULES) {
      if (rule.skipKinds?.includes(doc.kind)) continue;
      const offset = rule.zone === 'tail' ? Math.max(0, text.length - TAIL_CHARS) : 0;
      const zoneText =
        rule.zone === 'head' ? text.slice(0, HEAD_CHARS) : rule.zone === 'tail' ? text.slice(offset) : text;
      const r = scan(zoneText, rule.re, rule.id, rule.strength);
      if (r.count < (rule.min ?? 1)) continue;

      for (const h of r.highlights) highlights.push({ ...h, start: h.start + offset, end: h.end + offset });

      let vendors = rule.vendors;
      if (rule.id === 'art-utm') {
        const v = [...r.distinct].map(vendorOf).find(Boolean);
        vendors = v ? [{ vendor: v, weight: 3 }] : undefined;
      }
      signals.push({
        id: rule.id,
        category: 'artefact',
        label: rule.label,
        detail: rule.detail,
        strength: rule.strength,
        direction: 'ia',
        points: rule.points,
        vendors,
        evidence: r.evidence,
        count: r.count,
      });
    }

    const hiddenUtm = doc.urls.filter((u) =>
      /utm_source=(chatgpt|openai|perplexity|copilot|gemini|claude|you\.com)/i.test(u),
    );
    if (hiddenUtm.length > 0 && !signals.some((s) => s.id === 'art-utm')) {
      const v = vendorOf(hiddenUtm[0]);
      signals.push({
        id: 'art-utm',
        category: 'artefact',
        label: "Lien avec traceur utm_source d'un assistant IA (lien du fichier)",
        detail:
          "Un lien cliquable du fichier porte « utm_source=chatgpt.com » (ou équivalent) : la source a été copiée depuis l'assistant.",
        strength: 'fort',
        direction: 'ia',
        points: 45,
        vendors: v ? [{ vendor: v, weight: 3 }] : undefined,
        evidence: hiddenUtm.slice(0, 5),
        count: hiddenUtm.length,
      });
    }

    if (doc.kind !== 'md' && doc.kind !== 'code') {
      const md = scan(text, MARKDOWN_RE, 'art-markdown', 'moyen');
      if (md.count >= 2) {
        const inOffice = doc.kind === 'docx' || doc.kind === 'pdf';
        highlights.push(...md.highlights);
        signals.push({
          id: 'art-markdown',
          category: 'artefact',
          label: 'Mise en forme Markdown brute (**gras**, ### titres…)',
          detail: inOffice
            ? 'Des astérisques ou des dièses de mise en forme apparaissent tels quels dans le document : le texte a été copié depuis une interface de chat (qui écrit en Markdown) puis collé sans rendu.'
            : "Le texte contient du Markdown brut (**gras**, ### titres, ---) : c'est le format natif des réponses de chatbot. Peut aussi venir de notes personnelles (Notion, Obsidian…).",
          strength: 'moyen',
          direction: 'ia',
          points: inOffice ? 20 : 12,
          evidence: md.evidence,
          count: md.count,
        });
      }
    }
    return { signals, highlights };
  }
}
