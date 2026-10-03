import { Card, Collapse, Empty, Flex, Tag, Tooltip, Typography } from 'antd';
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
import type { ReactNode } from 'react';
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

const ORDER: SignalCategory[] = ['metadata', 'artefact', 'unicode', 'model', 'code', 'style', 'stats'];

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
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
      <Flex gap={8} align="flex-start">
        <span style={{ marginTop: 3 }}>
          <DirectionIcon s={s} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Flex gap={6} align="center" wrap>
            <Text strong>{s.label}</Text>
            <Tag color={STRENGTH_COLORS[s.strength]} style={{ marginInlineEnd: 0 }}>
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
            <Flex vertical gap={3}>
              {s.evidence.map((e, i) => (
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
              ))}
            </Flex>
          )}
        </div>
      </Flex>
    </div>
  );
}

export function SignalList({ signals }: { signals: Signal[] }) {
  const groups = ORDER.map((cat) => ({ cat, items: signals.filter((s) => s.category === cat) })).filter(
    (g) => g.items.length > 0,
  );
  if (groups.length === 0) {
    return (
      <Card size="small" title="Indices détectés">
        <Empty description="Aucun indice relevé." />
      </Card>
    );
  }
  return (
    <Card size="small" title="Indices détectés" styles={{ body: { padding: 0 } }}>
      <Collapse
        bordered={false}
        ghost
        defaultActiveKey={groups.map((g) => g.cat)}
        items={groups.map(({ cat, items }) => {
          const ia = items.filter((s) => s.direction === 'ia').length;
          const hu = items.filter((s) => s.direction === 'humain').length;
          return {
            key: cat,
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
    </Card>
  );
}
