import { Card, Flex, Progress, Tag, Tooltip, Typography } from 'antd';
import { RobotOutlined, ToolOutlined } from '@ant-design/icons';
import type { AnalysisReport, OriginScore } from '../types';
import { VENDOR_COLORS } from '../constants';

const { Text } = Typography;

const SOFTWARE_COLOR = '#1677ff';

function originsOf(report: AnalysisReport): OriginScore[] {
  if (report.origins) return report.origins;
  return report.vendors.map((v) => ({
    id: v.vendor,
    kind: 'ia',
    label: v.label,
    score: v.score,
    level: v.level ?? 'indice',
    reasons: v.reasons,
    vendor: v.vendor,
  }));
}

function Row({ o }: { o: OriginScore }) {
  const color = o.kind === 'ia' && o.vendor ? VENDOR_COLORS[o.vendor] : SOFTWARE_COLOR;
  return (
    <div>
      <Flex justify="space-between" align="center" gap={8}>
        <Flex align="center" gap={6} style={{ minWidth: 0 }}>
          <Tooltip title={o.kind === 'ia' ? 'Assistant IA' : 'Logiciel ou bibliothèque'}>
            {o.kind === 'ia' ? <RobotOutlined style={{ color }} /> : <ToolOutlined style={{ color }} />}
          </Tooltip>
          <Text strong style={{ fontSize: 13 }} ellipsis>
            {o.label}
          </Text>
          {o.kind === 'ia' && o.level === 'trace' && (
            <Tag color="red" style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px' }}>
              trace
            </Tag>
          )}
        </Flex>
        <Text strong style={{ fontSize: 13, color: o.score ? color : undefined }}>
          {o.score === null ? '?' : `${o.score} %`}
        </Text>
      </Flex>
      <Progress
        percent={o.score ?? 0}
        showInfo={false}
        strokeColor={color}
        size="small"
        style={{ margin: 0 }}
      />
      {o.reasons.length > 0 && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {o.reasons.join(' · ')}
        </Text>
      )}
    </div>
  );
}

export function OriginCard({ report }: { report: AnalysisReport }) {
  const origins = originsOf(report);
  const ai = origins.filter((o) => o.kind === 'ia');
  const anyTrace = ai.some((o) => o.level === 'trace');
  const undetermined = ai.every((o) => o.score === null);

  let note: string;
  if (undetermined)
    note =
      'Probabilité IA indéterminable sur ce texte : la part de chaque assistant ne peut pas être estimée.';
  else if (anyTrace)
    note = 'La probabilité IA est attribuée en priorité aux assistants dont une trace propre a été trouvée.';
  else
    note =
      'Aucune trace propre à un assistant : la probabilité IA est répartie à parts égales, le style seul ne permettant pas de les distinguer.';

  return (
    <Card
      size="small"
      title={
        <span>
          <ToolOutlined /> Quel outil ?
        </span>
      }
    >
      <Flex vertical gap={10}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Logiciels : certitude d'après les métadonnées du fichier. Assistants IA : part de la probabilité IA
          globale. {note}
        </Text>
        {origins.map((o) => (
          <Row key={o.id} o={o} />
        ))}
      </Flex>
    </Card>
  );
}
