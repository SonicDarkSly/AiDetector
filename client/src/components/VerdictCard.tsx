import { Card, Flex, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import { FileOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { AnalysisReport, MeasuredRate } from '../types';
import { KIND_LABELS, LANGUAGE_LABELS, MEASURED_RATES, scoreColor } from '../constants';
import { formatDate, formatSize } from '../utils/format';
import { KnownAnswer } from './KnownAnswer';

const { Title, Text, Paragraph } = Typography;

const CONFIDENCE_COLORS = { faible: 'default', moyenne: 'blue', élevée: 'purple' } as const;

export function VerdictCard({ report }: { report: AnalysisReport }) {
  const undetermined = report.undetermined === true;
  const color = undetermined ? '#8c8c8c' : scoreColor(report.score);
  const { source, stats } = report;
  return (
    <Card className="verdict-card">
      <div className="verdict-main">
        <Progress
          type="dashboard"
          percent={undetermined ? 0 : report.score}
          strokeColor={color}
          size={150}
          format={(p) =>
            undetermined ? (
              <span style={{ color }}>
                <span className="verdict-value" style={{ fontWeight: 700 }}>
                  ?
                </span>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>indéterminable</div>
              </span>
            ) : (
              <span style={{ color }}>
                <span className="verdict-value" style={{ fontWeight: 700 }}>
                  {p}
                </span>
                <span style={{ fontSize: 16 }}> %</span>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>score IA</div>
              </span>
            )
          }
        />
        <div className="verdict-info">
          <Title
            level={4}
            className="verdict-title"
            style={{ margin: 0, color, ['--chars' as string]: report.verdict.length }}
          >
            {report.verdict}
          </Title>
          <Space size={6} wrap className="verdict-tags">
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
          {undetermined && report.modelScore != null && report.languageModel?.domain !== 'verse' && (
            <Trend score={report.modelScore} />
          )}
          <Flex vertical gap={4} className="verdict-bars">
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
                  <Reliability
                    tokens={report.languageModel?.tokens}
                    domain={report.languageModel?.domain}
                    measured={report.languageModel?.rate}
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
                  format={(p) => `${p}%`}
                />
              </div>
            </Tooltip>
          </Flex>
        </div>
      </div>
      <div className="verdict-footer">
        <Text type="secondary" style={{ fontSize: 11 }}>
          Analysé le {formatDate(report.analyzedAt)} · {formatSize(source.size)} · {stats.words} mots ·{' '}
          {LANGUAGE_LABELS[stats.language]}
        </Text>
        <KnownAnswer report={report} />
      </div>
    </Card>
  );
}

function Reliability({
  tokens,
  domain,
  measured,
}: {
  tokens?: number;
  domain?: string;
  measured?: MeasuredRate;
}) {
  if (!tokens) return null;
  if (domain === 'verse')
    return (
      <Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: -2 }}>
        Texte en vers : le modèle n'est calibré que sur de la prose, valeur indicative
      </Text>
    );
  if (tokens < MEASURED_RATES[0].tokens)
    return (
      <Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: -2 }}>
        Sur {tokens} tokens seulement : valeur indicative, non fiable
      </Text>
    );
  const rate = measured
    ? {
        detected: Math.round(measured.detected * 100),
        falsePositives: Math.round(measured.falsePositives * 100),
      }
    : ([...MEASURED_RATES].reverse().find((r) => tokens >= r.tokens) ?? MEASURED_RATES[0]);
  return (
    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: -2 }}>
      Sur {tokens} tokens : {rate.detected} % des textes IA repérés, {rate.falsePositives} % de textes humains
      signalés à tort
    </Text>
  );
}

function Trend({ score }: { score: number }) {
  const lean = score < 35 ? 'plutôt humain' : score > 65 ? 'plutôt IA' : 'aucune tendance nette';
  return (
    <Tooltip title="Mesure faite sur trop peu de mots pour conclure : elle donne une direction, pas un verdict.">
      <Tag
        color={score < 35 ? 'green' : score > 65 ? 'volcano' : 'default'}
        style={{ marginBottom: 12, cursor: 'help' }}
      >
        Tendance indicative : {lean} ({score} % IA)
      </Tag>
    </Tooltip>
  );
}
