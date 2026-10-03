import { Card, Collapse, Empty, Flex, Tag, Tooltip, Typography, theme } from 'antd';
import {
  BarChartOutlined,
  CodeOutlined,
  EditOutlined,
  ExperimentOutlined,
  EyeInvisibleOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { CSSProperties, ReactNode } from 'react';
import type { Signal, SignalCategory } from '../types';
import { CATEGORY_HINTS, CATEGORY_LABELS, STRENGTH_COLORS, STRENGTH_LABELS } from '../constants';

const { Text, Paragraph } = Typography;

const CATEGORY_ICONS: Record<SignalCategory, ReactNode> = {
  metadata: <FileSearchOutlined />,
  artefact: <MessageOutlined />,
  unicode: <EyeInvisibleOutlined />,
  model: <ExperimentOutlined />,
  code: <CodeOutlined />,
  style: <EditOutlined />,
  stats: <BarChartOutlined />,
};

const TECHNICAL: SignalCategory[] = ['metadata', 'artefact', 'unicode'];
const INDICATORS: SignalCategory[] = ['model', 'code', 'style', 'stats'];

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
            <Flex vertical gap={dark ? 4 : 3} align={dark ? 'flex-start' : undefined}>
              {s.evidence.map((e, i) =>
                dark ? (
                  <span key={i} className="evidence-chip">
                    {e}
                  </span>
                ) : (
                  <Text
                    key={i}
                    code
                    style={{
                      fontSize: 11.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      display: 'block',
                    }}
                  >
                    {e}
                  </Text>
                ),
              )}
            </Flex>
          )}
        </div>
      </Flex>
    </div>
  );
}

const ACCENTS = {
  technical: { rgb: '255, 77, 79', text: '#ff8f91' },
  indicators: { rgb: '146, 84, 222', text: '#c5a3f7' },
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
      className={dark ? 'signal-groups dark' : 'signal-groups'}
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

function SectionHeader({ kind, children }: { kind: SectionKind; children: ReactNode }) {
  const { token } = theme.useToken();
  const dark = useDark();
  const danger = kind === 'technical';
  const style: CSSProperties = dark
    ? {
        background: `linear-gradient(90deg, rgba(${ACCENTS[kind].rgb}, 0.22), rgba(${ACCENTS[kind].rgb}, 0.06))`,
        color: ACCENTS[kind].text,
        borderBottom: `1px solid rgba(${ACCENTS[kind].rgb}, 0.3)`,
      }
    : {
        background: danger ? token.colorErrorBg : token.colorFillSecondary,
        color: danger ? token.colorErrorText : token.colorTextSecondary,
        borderTop: danger ? 'none' : `1px solid ${token.colorBorder}`,
        borderBottom: `1px solid ${danger ? token.colorErrorBorder : token.colorBorder}`,
      };
  return (
    <div className="signal-section" style={style}>
      {children}
    </div>
  );
}

function Section({ kind, children }: { kind: SectionKind; children: ReactNode }) {
  const dark = useDark();
  if (!dark) return <>{children}</>;
  return (
    <div
      className="signal-panel"
      style={{
        border: `1px solid rgba(${ACCENTS[kind].rgb}, 0.32)`,
        background: `rgba(${ACCENTS[kind].rgb}, 0.03)`,
      }}
    >
      {children}
    </div>
  );
}

export function SignalList({ signals: all, mainOnly = false }: { signals: Signal[]; mainOnly?: boolean }) {
  const dark = useDark();
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
  return (
    <Card
      size="small"
      title="Indices détectés"
      styles={{
        body: dark ? { padding: 12, display: 'flex', flexDirection: 'column', gap: 12 } : { padding: 0 },
      }}
    >
      <Section kind="technical">
        <SectionHeader kind="technical">
          <span>Preuves techniques</span>
          {proofs > 0 && <Tag color="red">{proofs} trouvée(s)</Tag>}
        </SectionHeader>
        {technical.length > 0 ? (
          <Groups signals={technical} order={TECHNICAL} />
        ) : (
          <Text type="secondary" style={{ display: 'block', padding: '10px 16px', fontSize: 13 }}>
            Aucune trace technique : ni métadonnée d'IA, ni artefact de chatbot, ni caractère caché.
          </Text>
        )}
      </Section>
      {indicators.length > 0 && (
        <Section kind="indicators">
          <SectionHeader kind="indicators">
            <span>Indices statistiques et de style</span>
          </SectionHeader>
          <Groups signals={indicators} order={INDICATORS} />
        </Section>
      )}
    </Card>
  );
}
