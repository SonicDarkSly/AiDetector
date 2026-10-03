import { Card, Flex, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import { FileOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { AnalysisReport, LanguageModelUsage } from '../types';
import { KIND_LABELS, LANGUAGE_LABELS, scoreColor } from '../constants';
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
                />
              </div>
            </Tooltip>
            {(report.modelScore != null || report.languageModel) && (
              <Tooltip title="Probabilité estimée par un modèle de langage local à partir de la prévisibilité du texte. Peu fiable sous ~150 mots.">
                <div>
                  <Text style={{ fontSize: 12 }}>Modèle de langage</Text>
                  {report.modelScore != null ? (
                    <Progress
                      percent={report.modelScore}
                      strokeColor={scoreColor(report.modelScore)}
                      size="small"
                    />
                  ) : (
                    <Progress percent={0} size="small" format={() => '–'} />
                  )}
                  <ModelLine usage={report.languageModel} />
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

const UNUSED: Record<string, string> = {
  'too-short': 'texte trop court pour le modèle',
  skipped: 'non utilisé pour ce type de contenu',
  missing: 'pas encore téléchargé, relancez avec le lanceur',
  disabled: 'désactivé (MEFIANCE_MODEL=off)',
  error: 'chargement impossible, voir server/logs',
};

function ModelLine({ usage }: { usage?: LanguageModelUsage | null }) {
  if (!usage) return null;
  const name = usage.name ?? 'modèle local';
  const detail =
    usage.status === 'used'
      ? `${usage.tokens} tokens en ${((usage.elapsedMs ?? 0) / 1000).toFixed(1).replace('.', ',')} s`
      : (UNUSED[usage.status] ?? 'non utilisé');
  return (
    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: -2 }}>
      Modèle : {usage.status === 'disabled' ? 'aucun' : name} · {detail}
    </Text>
  );
}
