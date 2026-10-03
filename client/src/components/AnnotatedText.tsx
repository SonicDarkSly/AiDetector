import { useMemo, useState } from 'react';
import { Alert, Button, Card, Flex, Space, Switch, Tag, Typography, message } from 'antd';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { AnalysisReport } from '../types';
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

function invisibleName(c: string): string {
  if (INVISIBLE[c]) return INVISIBLE[c];
  const cp = c.codePointAt(0) ?? 0;
  if (cp >= 0xe0000 && cp <= 0xe007f) {
    const hidden = [...c].map((x) => String.fromCharCode((x.codePointAt(0) ?? 0xe0000) - 0xe0000)).join('');
    return `TAG « ${hidden} »`;
  }
  return `U+${cp.toString(16).toUpperCase()}`;
}

function renderChunk(s: string, showInvisible: boolean, keyBase: string): ReactNode[] {
  if (!showInvisible) return [s];
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of s.matchAll(INVISIBLE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(s.slice(last, idx));
    out.push(
      <span key={`${keyBase}-i${i++}`} className="invisible-char">
        {invisibleName(m[0])}
      </span>,
    );
    last = idx + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function AnnotatedText({ report }: { report: AnalysisReport }) {
  const boxClass = `annotated ${report.source.kind === 'code' ? 'code' : ''}`;
  const [showInvisible, setShowInvisible] = useState(true);
  const [showClean, setShowClean] = useState(false);
  const labels = useMemo(() => new Map(report.signals.map((s) => [s.id, s.label])), [report.signals]);

  const content = useMemo(() => {
    const text = report.text;
    const nodes: ReactNode[] = [];
    let pos = 0;
    report.highlights.forEach((h, n) => {
      if (h.start < pos) return;
      if (h.start > pos) nodes.push(...renderChunk(text.slice(pos, h.start), showInvisible, `t${n}`));
      nodes.push(
        <span key={`h${n}`} className={`hl hl-${h.level}`} title={labels.get(h.signalId) ?? h.signalId}>
          {renderChunk(text.slice(h.start, h.end), showInvisible, `h${n}`)}
        </span>,
      );
      pos = h.end;
    });
    if (pos < text.length) nodes.push(...renderChunk(text.slice(pos), showInvisible, 'end'));
    return nodes;
  }, [report, showInvisible, labels]);

  const cleaned = report.cleaned;
  const baseName = (report.source.filename ?? 'texte').replace(/\.[^.]+$/, '');

  return (
    <Card
      size="small"
      title="Texte analysé"
      extra={
        <Space size={12} wrap>
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
          <Flex gap={6} wrap style={{ marginBottom: 10 }}>
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
            <Text type="secondary" style={{ fontSize: 12 }}>
              (survolez un passage pour voir le signal)
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
