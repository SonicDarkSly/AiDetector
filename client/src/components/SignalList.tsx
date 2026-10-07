import { Card, Collapse, Empty, Flex, Tag, Tooltip, Typography, theme } from 'antd';
import {
  BarChartOutlined,
  BranchesOutlined,
  CodeOutlined,
  EditOutlined,
  ExperimentOutlined,
  EyeInvisibleOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { CSSProperties, ReactNode } from 'react';
import type { Signal, SignalCategory } from '../types';
import { CATEGORY_HINTS, CATEGORY_LABELS, STRENGTH_COLORS, STRENGTH_LABELS } from '../constants';
import { useFold } from '../hooks/useFold';
import { FoldChevron } from './FoldChevron';

const { Text, Paragraph } = Typography;

const CATEGORY_ICONS: Record<SignalCategory, ReactNode> = {
  project: <BranchesOutlined />,
  metadata: <FileSearchOutlined />,
  artefact: <MessageOutlined />,
  unicode: <EyeInvisibleOutlined />,
  model: <ExperimentOutlined />,
  code: <CodeOutlined />,
  style: <EditOutlined />,
  stats: <BarChartOutlined />,
  watermark: <SafetyCertificateOutlined />,
};

const TECHNICAL: SignalCategory[] = ['project', 'metadata', 'artefact', 'unicode'];
const INDICATORS: SignalCategory[] = ['model', 'code', 'style', 'stats', 'watermark'];

function DirectionIcon({ s }: { s: Signal }) {
  if (s.direction === 'ia')
    return (
      <Tooltip title="Pousse vers « IA »">
        <RobotOutlined style={{ color: '#cf1322' }} />
      </Tooltip>
    );
  if (s.direction === 'humain')
    return (
      <Tooltip title="Pousse vers « humain »">
        <UserOutlined style={{ color: '#389e0d' }} />
      </Tooltip>
    );
  return (
    <Tooltip title="Information">
      <InfoCircleOutlined style={{ opacity: 0.6 }} />
    </Tooltip>
  );
}

function SignalItem({ s }: { s: Signal }) {
  const { token } = theme.useToken();
  const dark = useDark();
  return (
    <div
      className="signal-item"
      style={{
        padding: '8px 0',
        borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : token.colorSplit}`,
      }}
    >
      <Flex gap={8} align="flex-start">
        <span style={{ marginTop: 3 }}>
          <DirectionIcon s={s} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Flex gap={6} align="center" wrap>
            <Text strong>{s.label}</Text>
            <Tag
              color={s.direction === 'humain' ? 'green' : STRENGTH_COLORS[s.strength]}
              style={{ marginInlineEnd: 0 }}
            >
              {STRENGTH_LABELS[s.strength]}
            </Tag>
            {s.points !== 0 && (
              <Tooltip title="Contribution au score">
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {s.points > 0 ? `+${s.points}` : s.points} pts
                </Text>
              </Tooltip>
            )}
          </Flex>
          <Paragraph type="secondary" style={{ margin: '4px 0', fontSize: 13 }}>
            {s.detail}
          </Paragraph>
          {s.evidence && s.evidence.length > 0 && (
            <Flex vertical gap={4} align="flex-start">
              {s.evidence.map((e, i) => (
                <span key={i} className={dark ? 'evidence-chip dark' : 'evidence-chip'}>
                  {e}
                </span>
              ))}
            </Flex>
          )}
        </div>
      </Flex>
    </div>
  );
}

const ACCENTS = {
  technical: { rgb: '255, 77, 79', dark: '#ff8f91', light: '#cf1322' },
  indicators: { rgb: '146, 84, 222', dark: '#c5a3f7', light: '#722ed1' },
} as const;
type SectionKind = keyof typeof ACCENTS;

function useDark(): boolean {
  const { token } = theme.useToken();
  return token.colorTextBase === '#fff';
}

function Groups({ signals, order }: { signals: Signal[]; order: SignalCategory[] }) {
  const { token } = theme.useToken();
  const dark = useDark();
  const separator = dark ? 'rgba(255,255,255,0.08)' : token.colorBorderSecondary;
  const groups = order
    .map((cat) => ({ cat, items: signals.filter((s) => s.category === cat) }))
    .filter((g) => g.items.length > 0);
  return (
    <Collapse
      bordered={false}
      ghost
      className="signal-groups"
      defaultActiveKey={groups.map((g) => g.cat)}
      items={groups.map(({ cat, items }, i) => {
        const ia = items.filter((s) => s.direction === 'ia').length;
        const hu = items.filter((s) => s.direction === 'humain').length;
        return {
          key: cat,
          style: i > 0 ? { borderTop: `1px solid ${separator}` } : undefined,
          label: (
            <Flex justify="space-between" align="center" wrap gap={6}>
              <span>
                {CATEGORY_ICONS[cat]} <Text strong>{CATEGORY_LABELS[cat]}</Text>{' '}
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {CATEGORY_HINTS[cat]}
                </Text>
              </span>
              <span>
                {ia > 0 && <Tag color="red">{ia} IA</Tag>}
                {hu > 0 && <Tag color="green">{hu} humain</Tag>}
              </span>
            </Flex>
          ),
          children: items.map((s) => <SignalItem key={s.id} s={s} />),
        };
      })}
    />
  );
}

function Section({
  kind,
  title,
  extra,
  children,
}: {
  kind: SectionKind;
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const dark = useDark();
  const [folded, toggle] = useFold(`signals-${kind}`);
  const { rgb } = ACCENTS[kind];
  const header: CSSProperties = {
    background: `linear-gradient(90deg, rgba(${rgb}, ${dark ? 0.22 : 0.12}), rgba(${rgb}, ${dark ? 0.06 : 0.03}))`,
    color: dark ? ACCENTS[kind].dark : ACCENTS[kind].light,
    borderBottom: folded ? 'none' : `1px solid rgba(${rgb}, ${dark ? 0.3 : 0.25})`,
  };
  return (
    <div
      className="signal-panel"
      style={{
        border: `1px solid rgba(${rgb}, ${dark ? 0.32 : 0.3})`,
        background: `rgba(${rgb}, ${dark ? 0.03 : 0.015})`,
      }}
    >
      <button
        type="button"
        className="signal-section"
        style={header}
        onClick={toggle}
        aria-expanded={!folded}
      >
        <span>
          <FoldChevron folded={folded} /> {title}
        </span>
        {extra}
      </button>
      {!folded && children}
    </div>
  );
}

export function SignalList({ signals: all, mainOnly = false }: { signals: Signal[]; mainOnly?: boolean }) {
  const main = all.filter(
    (s) => s.direction !== 'neutre' && (s.strength === 'fort' || s.strength === 'moyen'),
  );
  const signals = mainOnly && main.length > 0 ? main : all;
  const technical = signals.filter((s) => TECHNICAL.includes(s.category));
  const indicators = signals.filter((s) => INDICATORS.includes(s.category));
  if (technical.length === 0 && indicators.length === 0) {
    return (
      <Card size="small" title="Indices détectés">
        <Empty description="Aucun indice relevé." />
      </Card>
    );
  }
  const proofs = technical.filter((s) => s.direction === 'ia' && s.points > 0).length;
  // le filigrane n'est qu'une information, pas un indice
  const clues = indicators.filter((s) => s.category !== 'watermark').length;
  return (
    <Card
      size="small"
      title="Indices détectés"
      styles={{
        body: { padding: 12, display: 'flex', flexDirection: 'column', gap: 12 },
      }}
    >
      <Section
        kind="technical"
        title="Preuves techniques"
        extra={proofs > 0 && <Tag color="red">{proofs} trouvée(s)</Tag>}
      >
        {technical.length > 0 ? (
          <Groups signals={technical} order={TECHNICAL} />
        ) : (
          <Text type="secondary" style={{ display: 'block', padding: '10px 16px', fontSize: 13 }}>
            Aucune trace technique : ni métadonnée d'IA, ni artefact de chatbot, ni caractère caché.
          </Text>
        )}
      </Section>
      {indicators.length > 0 && (
        <Section
          kind="indicators"
          title="Indices statistiques et de style"
          extra={clues > 0 && <Tag>{clues} indice(s)</Tag>}
        >
          <Groups signals={indicators} order={INDICATORS} />
        </Section>
      )}
    </Card>
  );
}
