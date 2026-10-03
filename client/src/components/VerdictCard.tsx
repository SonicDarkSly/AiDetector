import { Card, Flex, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import { FileOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { AnalysisReport } from '../types';
import { KIND_LABELS, LANGUAGE_LABELS, MEASURED_RATES, scoreColor } from '../constants';
import { formatDate, formatSize } from '../utils/format';

const { Title, Text, Paragraph } = Typography;

const CONFIDENCE_COLORS = { faible: 'default', moyenne: 'blue', élevée: 'purple' } as const;

export function VerdictCard({ report }: { report: AnalysisReport }) {
  const undetermined = report.undetermined === true;
  const color = undetermined ? '#8c8c8c' : scoreColor(report.score);
  const { source, stats } = report;
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
                  format={(p) => `${p}%`}
                />
              </div>
            </Tooltip>
            {report.modelScore != null && (
              <Tooltip title="Mesurée par un modèle de langage local : plus les mots choisis sont attendus, plus le texte ressemble à une production d'IA.">
                <div>
                  <Text style={{ fontSize: 12 }}>Prévisibilité du texte</Text>
                  <Progress
                    percent={report.modelScore}
                    strokeColor={scoreColor(report.modelScore)}
                    size="small"
                    format={(p) => `${p}%`}
                  />
                  <Reliability tokens={report.languageModel?.tokens} />
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
                  format={(p) => `${p}%`}
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

function Reliability({ tokens }: { tokens?: number }) {
  if (!tokens) return null;
  const rate = [...MEASURED_RATES].reverse().find((r) => tokens >= r.tokens) ?? MEASURED_RATES[0];
  return (
    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: -2 }}>
      Sur {tokens} tokens : {rate.detected} % des textes IA repérés, {rate.falsePositives} % de textes humains
      signalés à tort
    </Text>
  );
}
