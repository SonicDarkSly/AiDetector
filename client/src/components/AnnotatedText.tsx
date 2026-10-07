import { useMemo, useState } from 'react';
import { Alert, Button, Card, Flex, Space, Switch, Tag, Tooltip, Typography, message } from 'antd';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { AnalysisReport, Signal } from '../types';
import { STRENGTH_COLORS, STRENGTH_LABELS } from '../constants';
import { copyText, downloadText } from '../utils/clipboard';

const { Text } = Typography;

const INVISIBLE: Record<string, string> = {
  '\u200B': 'ZWSP',
  '\u200C': 'ZWNJ',
  '\u200D': 'ZWJ',
  '\u2060': 'WJ',
  '\uFEFF': 'BOM',
  '\u202F': 'NNBSP',
  '\u00AD': 'SHY',
  '\u180E': 'MVS',
};
const INVISIBLE_RE =
  /[\u200B\u200C\u200D\u2060\uFEFF\u202F\u00AD\u180E\u202A-\u202E\u2066-\u2069\uE000-\uF8FF\uFE00-\uFE0F]|[\u{E0000}-\u{E007F}]+/gu;

const TAGS: Record<string, string> = {
  'art-oaicite': 'marqueur ChatGPT',
  'art-oai-brackets': 'marqueur ChatGPT',
  'art-citeturn': 'marqueur ChatGPT',
  'art-oai-images': 'image ChatGPT',
  'uni-oai-pua': 'marqueur ChatGPT',
  'art-gemini-cite': 'marqueur Gemini',
  'art-claude-tags': 'balise Claude',
  'art-deepseek-cite': 'marqueur DeepSeek',
  'art-think': 'raisonnement DeepSeek / Qwen',
  'art-copilot-cite': 'renvoi Copilot',
  'art-grok-render': 'balise Grok',
  'art-numeric-cites': 'renvois type Perplexity',
  'art-share-link': 'lien de conversation IA',
  'art-self-vendor': "l'IA se nomme",
  'art-self-ai': "l'IA parle d'elle",
  'art-refusal': "refus d'assistant",
  'art-opening': 'intro de chatbot',
  'art-closing': 'conclusion de chatbot',
  'art-placeholders': 'champ à remplir',
  'art-utm': 'traceur utm',
  'art-emoji-bullets': 'émoji en puce',
  'art-latex': 'LaTeX brut',
  'art-markdown': 'Markdown brut',
  'uni-homoglyph': 'lettre déguisée',
  'sty-lexicon': 'tournure IA',
  'sty-not-x': 'pas X, mais Y',
  'sty-transitions': 'transition',
  'sty-label-list': 'liste « Titre : »',
  'sty-emdash': 'tiret long',
  'sty-casual': 'marque humaine',
  'sty-punct': 'marque humaine',
  'sty-sloppy': 'marque humaine',
};

function isTagRun(c: string): boolean {
  const cp = c.codePointAt(0) ?? 0;
  return cp >= 0xe0000 && cp <= 0xe007f;
}

function invisibleName(c: string): string {
  if (INVISIBLE[c]) return INVISIBLE[c];
  if (isTagRun(c)) {
    return [...c].map((x) => String.fromCharCode((x.codePointAt(0) ?? 0xe0000) - 0xe0000)).join('');
  }
  return `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase()}`;
}

function renderChunk(s: string, showInvisible: boolean, keyBase: string): ReactNode[] {
  if (!showInvisible) return [s];
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of s.matchAll(INVISIBLE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(s.slice(last, idx));
    const hidden = isTagRun(m[0]);
    out.push(
      <Tooltip
        key={`${keyBase}-i${i++}`}
        title={
          hidden
            ? 'Message caché en caractères « tags » Unicode, invisible à l\u2019écran et décodé ici.'
            : `Caractère invisible ${invisibleName(m[0])} : absent à l\u2019écran, souvent laissé par un copier-coller.`
        }
      >
        <span className={hidden ? 'hidden-message' : 'invisible-char'}>{invisibleName(m[0])}</span>
      </Tooltip>,
    );
    last = idx + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function SignalTip({ signal, id }: { signal?: Signal; id: string }) {
  if (!signal) return <span>{id}</span>;
  const human = signal.direction === 'humain';
  return (
    <div className="hl-tip">
      <Flex gap={6} align="center" wrap>
        <strong>{signal.label}</strong>
        <Tag color={human ? 'green' : STRENGTH_COLORS[signal.strength]} style={{ marginInlineEnd: 0 }}>
          {human ? 'marque humaine' : STRENGTH_LABELS[signal.strength]}
        </Tag>
        {signal.points !== 0 && (
          <span className="hl-tip-points">{signal.points > 0 ? `+${signal.points}` : signal.points} pts</span>
        )}
      </Flex>
      <div className="hl-tip-detail">{signal.detail}</div>
    </div>
  );
}

export function AnnotatedText({ report }: { report: AnalysisReport }) {
  const boxClass = `annotated ${report.source.kind === 'code' ? 'code' : ''}`;
  const [showInvisible, setShowInvisible] = useState(true);
  const [showClean, setShowClean] = useState(false);
  const [showTags, setShowTags] = useState(true);
  const signals = useMemo(() => new Map(report.signals.map((s) => [s.id, s])), [report.signals]);
  const human = useMemo(
    () => new Set(report.signals.filter((s) => s.direction === 'humain').map((s) => s.id)),
    [report.signals],
  );

  const content = useMemo(() => {
    const text = report.text;
    const nodes: ReactNode[] = [];
    let pos = 0;
    report.highlights.forEach((h, n) => {
      if (h.start < pos) return;
      if (h.start > pos) nodes.push(...renderChunk(text.slice(pos, h.start), showInvisible, `t${n}`));
      nodes.push(
        <Tooltip key={`h${n}`} title={<SignalTip signal={signals.get(h.signalId)} id={h.signalId} />}>
          <span className={`hl hl-${h.level}`}>
            {renderChunk(text.slice(h.start, h.end), showInvisible, `h${n}`)}
          </span>
        </Tooltip>,
      );
      const tag = TAGS[h.signalId];
      if (showTags && tag && h.level !== 'info' && (h.level !== 'faible' || !h.signalId.startsWith('sty-'))) {
        nodes.push(
          <Tooltip key={`g${n}`} title={<SignalTip signal={signals.get(h.signalId)} id={h.signalId} />}>
            <span className={`hl-tag ${human.has(h.signalId) ? 'hl-tag-human' : `hl-tag-${h.level}`}`}>
              {tag}
            </span>
          </Tooltip>,
        );
      }
      pos = h.end;
    });
    if (pos < text.length) nodes.push(...renderChunk(text.slice(pos), showInvisible, 'end'));
    return nodes;
  }, [report, showInvisible, showTags, signals, human]);

  const cleaned = report.cleaned;
  const baseName = (report.source.filename ?? 'texte').replace(/\.[^.]+$/, '');

  return (
    <Card
      size="small"
      title="Texte analysé"
      extra={
        <Space size={12} wrap>
          <Space size={4}>
            <Switch size="small" checked={showTags} onChange={setShowTags} />
            <Text style={{ fontSize: 12 }}>Libellés</Text>
          </Space>
          <Space size={4}>
            <Switch size="small" checked={showInvisible} onChange={setShowInvisible} />
            <Text style={{ fontSize: 12 }}>Caractères invisibles</Text>
          </Space>
          {cleaned && (
            <Space size={4}>
              <Switch size="small" checked={showClean} onChange={setShowClean} />
              <Text style={{ fontSize: 12 }}>Version nettoyée</Text>
            </Space>
          )}
        </Space>
      }
    >
      {report.text.trim() === '' ? (
        <Text type="secondary">
          Aucun texte extrait (fichier scanné / image ?), seules les métadonnées ont été analysées.
        </Text>
      ) : showClean && cleaned ? (
        <>
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 10 }}
            message={`${cleaned.removed} élément(s) retiré(s) : caractères cachés, marqueurs de chatbot, traceurs utm, homoglyphes.`}
            action={
              <Space>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={async () =>
                    (await copyText(cleaned.text))
                      ? message.success('Texte nettoyé copié')
                      : message.error('Copie impossible')
                  }
                >
                  Copier
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => downloadText(cleaned.text, `${baseName}-nettoye.txt`)}
                >
                  .txt
                </Button>
              </Space>
            }
          />
          <div className={boxClass}>{cleaned.text}</div>
        </>
      ) : (
        <>
          <Flex gap={6} wrap align="center" style={{ marginBottom: 10 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Légende :
            </Text>
            <Tag className="hl hl-fort" bordered={false}>
              signal fort
            </Tag>
            <Tag className="hl hl-moyen" bordered={false}>
              moyen
            </Tag>
            <Tag className="hl hl-faible" bordered={false}>
              faible
            </Tag>
            {showInvisible && <span className="invisible-char">ZWSP</span>}
            {showInvisible && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                caractère invisible
              </Text>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              (survolez un libellé pour le détail)
            </Text>
          </Flex>
          <div className={boxClass}>{content}</div>
          {report.textTruncated && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
              Affichage limité aux 60 000 premiers caractères (l'analyse porte sur le texte complet, jusqu'à
              400 000).
            </Text>
          )}
        </>
      )}
    </Card>
  );
}
