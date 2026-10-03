import { Alert, Card, Flex, Progress, Tag, Tooltip, Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import type { VendorScore } from '../types';
import { VENDOR_COLORS } from '../constants';

const { Text } = Typography;

const LEVELS = {
  trace: { label: 'Trace spécifique', color: 'red' },
  indice: { label: 'Indice partagé', color: 'orange' },
  aucun: { label: 'Aucun indice', color: 'default' },
} as const;

interface Props {
  vendors: VendorScore[];
  aiLikely: boolean;
}

export function VendorCard({ vendors, aiLikely }: Props) {
  const withLevel = vendors.map((v) => ({ ...v, level: v.level ?? 'indice' }));
  const found = withLevel.filter((v) => v.level !== 'aucun');
  const none = withLevel.filter((v) => v.level === 'aucun');
  const anyTrace = found.some((v) => v.level === 'trace');

  return (
    <Card
      size="small"
      title={
        <span>
          <RobotOutlined /> Quelle IA ?
        </span>
      }
    >
      <Flex vertical gap={12}>
        {!anyTrace && (
          <Alert
            type="info"
            showIcon
            message={
              aiLikely
                ? "Aucune trace propre à une IA : le texte peut venir de n'importe lequel de ces assistants."
                : 'Aucune trace propre à une IA.'
            }
            description="Seuls des marqueurs techniques (codes de citation, liens, métadonnées) permettent de nommer une IA. Le style seul ne le permet pas de façon fiable."
          />
        )}
        {found.map((v) => (
          <div key={v.vendor}>
            <Flex justify="space-between" align="center" gap={8}>
              <Tag color={VENDOR_COLORS[v.vendor]} style={{ fontWeight: 600 }}>
                {v.label}
              </Tag>
              <Tag color={LEVELS[v.level].color} style={{ marginInlineEnd: 0 }}>
                {LEVELS[v.level].label}
              </Tag>
            </Flex>
            <Progress percent={v.score} showInfo={false} strokeColor={VENDOR_COLORS[v.vendor]} size="small" />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {v.reasons.join(' · ')}
            </Text>
          </div>
        ))}
        {none.length > 0 && (
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Aucun indice propre à :
            </Text>
            <Flex wrap gap={4}>
              {none.map((v) => (
                <Tooltip key={v.vendor} title="Aucun marqueur de cette IA trouvé">
                  <Tag style={{ marginInlineEnd: 0, opacity: 0.75 }}>{v.label}</Tag>
                </Tooltip>
              ))}
            </Flex>
          </div>
        )}
      </Flex>
    </Card>
  );
}
