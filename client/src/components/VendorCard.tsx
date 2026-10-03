import { Card, Empty, Flex, Progress, Tag, Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import type { VendorScore } from '../types';
import { VENDOR_COLORS } from '../constants';

const { Text } = Typography;

function level(score: number): string {
  if (score >= 60) return 'piste forte';
  if (score >= 25) return 'piste';
  return 'faible piste';
}

export function VendorCard({ vendors }: { vendors: VendorScore[] }) {
  return (
    <Card
      size="small"
      title={
        <span>
          <RobotOutlined /> Quelle IA ?
        </span>
      }
    >
      {vendors.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Aucune IA identifiable. Le style seul ne permet pas d'attribuer un texte à un modèle précis de
              façon fiable. Seules les traces techniques (marqueurs, métadonnées) le permettent.
            </Text>
          }
        />
      ) : (
        <Flex vertical gap={12}>
          {vendors.map((v) => (
            <div key={v.vendor}>
              <Flex justify="space-between" align="center">
                <Tag color={VENDOR_COLORS[v.vendor]} style={{ fontWeight: 600 }}>
                  {v.label}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {level(v.score)}
                </Text>
              </Flex>
              <Progress
                percent={v.score}
                showInfo={false}
                strokeColor={VENDOR_COLORS[v.vendor]}
                size="small"
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {v.reasons.join(' · ')}
              </Text>
            </div>
          ))}
        </Flex>
      )}
    </Card>
  );
}
