import { Card, Flex, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import { FileOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { AnalysisReport, Signal } from '../types';
import {
  CATEGORY_LABELS,
  KIND_LABELS,
  LANGUAGE_LABELS,
  STRENGTH_COLORS,
  STRENGTH_LABELS,
  scoreColor,
} from '../constants';
import { formatDate, formatSize } from '../utils/format';

const { Title, Text, Paragraph } = Typography;

const TECHNICAL = ['metadata', 'artefact', 'unicode'];
const STRENGTH_ORDER = { fort: 0, moyen: 1, faible: 2, info: 3 };

const CONFIDENCE_COLORS = { faible: 'default', moyenne: 'blue', élevée: 'purple' } as const;

export function VerdictCard({ report }: { report: AnalysisReport }) {
  const undetermined = report.undetermined === true;
  const color = undetermined ? '#8c8c8c' : scoreColor(report.score);
  const { source, stats } = report;
  const proofs = report.signals
    .filter((s) => TECHNICAL.includes(s.category) && s.direction === 'ia' && s.points > 0)
    .sort((a, b) => STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] || b.points - a.points);
  return (
    <Card>
      <Flex gap={20} align="center" wrap>
        <Progress
          type="dashboard"
          percent={undetermined ? 0 : report.score}
          strokeColor={color}
          size={150}
          format={(p) =>
            undetermined ? (
              <span style={{ color }}>
                <span style={{ fontSize: 40, fontWeight: 700 }}>?</span>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>indéterminable</div>
              </span>
            ) : (
              <span style={{ color }}>
                <span style={{ fontSize: 34, fontWeight: 700 }}>{p}</span>
                <span style={{ fontSize: 16 }}> %</span>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>score IA</div>
              </span>
            )
          }
        />
        <div style={{ flex: 1, minWidth: 220 }}>
          <Title level={4} style={{ margin: 0, color }}>
            {report.verdict}
          </Title>
          <Space size={6} wrap style={{ margin: '8px 0' }}>
            <Tooltip title="Élevée = au moins une trace technique forte. Faible = uniquement des indices de style.">
              <Tag icon={<SafetyCertificateOutlined />} color={CONFIDENCE_COLORS[report.confidence]}>
                Confiance {report.confidence}
              </Tag>
            </Tooltip>
            <Tag icon={<FileOutlined />}>
              {KIND_LABELS[source.kind]}
              {source.filename ? ` · ${source.filename}` : ''}
            </Tag>
          </Space>
          <Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
            {report.summary}
          </Paragraph>
          <Flex vertical gap={4}>
            <Tooltip title="Métadonnées, artefacts de copier-coller, caractères cachés : des traces concrètes, fiables quand elles existent.">
              <div>
                <Text style={{ fontSize: 12 }}>Preuves techniques</Text>
                <Progress
                  percent={report.technicalScore}
                  strokeColor={scoreColor(report.technicalScore)}
                  size="small"
                />
              </div>
            </Tooltip>
            {proofs.length > 0 && <ProofList proofs={proofs} />}
            {report.modelScore != null && (
              <Tooltip title="Probabilité estimée par le modèle de langage à partir de la prévisibilité du texte. Peu fiable sous ~150 mots.">
                <div>
                  <Text style={{ fontSize: 12 }}>Modèle de langage</Text>
                  <Progress
                    percent={report.modelScore}
                    strokeColor={scoreColor(report.modelScore)}
                    size="small"
                  />
                </div>
              </Tooltip>
            )}
            <Tooltip title="Vocabulaire, tournures, rythme des phrases : des tendances statistiques, jamais des preuves.">
              <div>
                <Text style={{ fontSize: 12 }}>Indices de style</Text>
                <Progress
                  percent={report.styleScore}
                  strokeColor={scoreColor(report.styleScore)}
                  size="small"
                />
              </div>
            </Tooltip>
          </Flex>
        </div>
      </Flex>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 10 }}>
        Analysé le {formatDate(report.analyzedAt)} · {formatSize(source.size)} · {stats.words} mots ·{' '}
        {LANGUAGE_LABELS[stats.language]}
      </Text>
    </Card>
  );
}

function ProofList({ proofs }: { proofs: Signal[] }) {
  return (
    <ul className="proof-list">
      {proofs.map((p) => (
        <li key={p.id}>
          <Tag color={STRENGTH_COLORS[p.strength]} bordered={false} style={{ marginInlineEnd: 6 }}>
            {STRENGTH_LABELS[p.strength]}
          </Tag>
          <Text strong style={{ fontSize: 12.5 }}>
            {p.label}
          </Text>
          <Text type="secondary" style={{ fontSize: 11.5 }}>
            {' '}
            {CATEGORY_LABELS[p.category].toLowerCase()}
            {p.count && p.count > 1 ? `, ${p.count} occurrences` : ''}
          </Text>
          {p.evidence && p.evidence.length > 0 && (
            <div className="proof-evidence">
              {p.evidence.slice(0, 2).map((e, i) => (
                <code key={i}>{e.length > 90 ? `${e.slice(0, 90)}\u2026` : e}</code>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
