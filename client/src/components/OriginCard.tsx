import { Card, Flex, Progress, Tag, Tooltip, Typography } from 'antd';
import { RobotOutlined, ToolOutlined } from '@ant-design/icons';
import type { AnalysisReport, OriginScore } from '../types';
import { PRIMARY, VENDOR_COLORS } from '../constants';
import { useFold } from '../hooks/useFold';
import { FoldChevron } from './FoldChevron';

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
            <Tooltip
              title={
                o.reasons.length ? `Détail dans « Indices détectés » : ${o.reasons.join(' · ')}` : undefined
              }
            >
              <Tag
                color="red"
                style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px', cursor: 'help' }}
              >
                trace
              </Tag>
            </Tooltip>
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
      {o.kind === 'logiciel' && o.reasons.length > 0 && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {o.reasons.join(' · ')}
        </Text>
      )}
    </div>
  );
}

function Fold({
  id,
  icon,
  title,
  hint,
  spaced = false,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  hint: React.ReactNode;
  spaced?: boolean;
  children: React.ReactNode;
}) {
  const [folded, toggle] = useFold(`origins-${id}`);
  return (
    <>
      <button
        type="button"
        className={spaced ? 'origin-subtitle spaced' : 'origin-subtitle'}
        onClick={toggle}
        aria-expanded={!folded}
      >
        <Text strong style={{ fontSize: 12 }}>
          <FoldChevron folded={folded} /> {icon} {title}
        </Text>
        {!folded && (
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
            {hint}
          </Text>
        )}
      </button>
      {!folded && children}
    </>
  );
}

function Pooled({ items, total, title }: { items: OriginScore[]; total: number | null; title: string }) {
  return (
    <div className="origin-pool">
      <Flex justify="space-between" align="center" gap={8}>
        <Flex align="center" gap={6}>
          <RobotOutlined style={{ color: PRIMARY }} />
          <Text strong style={{ fontSize: 13 }}>
            {title}
          </Text>
        </Flex>
        <Text strong style={{ fontSize: 13, color: total ? PRIMARY : undefined }}>
          {total === null ? '?' : `${total} %`}
        </Text>
      </Flex>
      <Progress
        percent={total ?? 0}
        showInfo={false}
        strokeColor={PRIMARY}
        size="small"
        style={{ margin: 0 }}
      />
      <Flex wrap gap={4} style={{ marginTop: 4 }}>
        {items.map((o) => (
          <Tag
            key={o.id}
            bordered={false}
            style={{
              marginInlineEnd: 0,
              fontSize: 11,
              color: o.vendor ? VENDOR_COLORS[o.vendor] : undefined,
              background: o.vendor ? `${VENDOR_COLORS[o.vendor]}1f` : undefined,
            }}
          >
            {o.label}
          </Tag>
        ))}
      </Flex>
    </div>
  );
}

export function OriginCard({ report, compact = false }: { report: AnalysisReport; compact?: boolean }) {
  const all = originsOf(report);
  const tools = all.filter((o) => o.kind === 'logiciel');
  const ai = all.filter((o) => o.kind === 'ia');
  const floor = Math.min(...ai.map((o) => o.score ?? 0));
  const stands = (o: OriginScore) => o.level === 'trace' || (o.score ?? 0) > floor;
  const identified = ai.filter(stands);
  const others = ai.filter((o) => !stands(o));
  const anyTrace = ai.some((o) => o.level === 'trace');
  const undetermined = ai.every((o) => o.score === null);
  const othersTotal = undetermined
    ? null
    : identified.length === 0
      ? report.score
      : others.reduce((a, o) => a + (o.score ?? 0), 0);

  let note: string;
  if (undetermined)
    note =
      'Probabilité IA indéterminable sur ce texte : la part de chaque assistant ne peut pas être estimée.';
  else if (identified.length === 0)
    note =
      "Aucune trace propre à un assistant : impossible de dire lequel, le style des IA est trop proche. Le pourcentage est la probabilité IA globale, pas celle d'un outil précis.";
  else if (anyTrace)
    note = 'La probabilité IA est attribuée en priorité aux assistants dont une trace propre a été trouvée.';
  else note = 'Indices légers vers certains assistants, sans trace certaine.';

  const shownTools = compact ? tools.filter((o) => (o.score ?? 0) > 0) : tools;
  const shownIdentified = compact ? identified.filter((o) => (o.score ?? 0) > 0) : identified;

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
        {(report.source.kind !== 'text' || shownTools.length > 0) && (
          <Fold
            id="software"
            icon={<ToolOutlined />}
            title="Logiciels"
            hint="Certitude d'après les métadonnées du fichier."
          >
            {shownTools.length > 0 ? (
              shownTools.map((o) => <Row key={o.id} o={o} />)
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Aucun logiciel identifié dans les métadonnées.
              </Text>
            )}
          </Fold>
        )}
        <Fold
          id="assistants"
          icon={<RobotOutlined />}
          title="Assistants IA"
          hint={`Part de la probabilité IA globale. ${note}`}
          spaced={report.source.kind !== 'text' || shownTools.length > 0}
        >
          {shownIdentified.map((o) => (
            <Row key={o.id} o={o} />
          ))}
          {others.length > 0 && othersTotal === 0 && identified.length > 0 && !compact && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Sans trace, à 0 % : {others.map((o) => o.label).join(', ')}
            </Text>
          )}
          {others.length > 0 &&
            !(othersTotal === 0 && identified.length > 0) &&
            (!compact || (othersTotal ?? 0) > 0) && (
              <Pooled
                items={others}
                total={othersTotal}
                title={
                  identified.length === 0 ? 'Assistant IA non identifiable' : 'Autres assistants, sans trace'
                }
              />
            )}
        </Fold>
      </Flex>
    </Card>
  );
}
