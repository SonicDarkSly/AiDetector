import { Card, Empty, Table, Tag, Typography } from 'antd';
import { WarningFilled } from '@ant-design/icons';
import type { DocKind, MetaEntry } from '../types';

const { Text } = Typography;

export function MetadataTable({ metadata, kind }: { metadata: MetaEntry[]; kind: DocKind }) {
  return (
    <Card size="small" title="Métadonnées du fichier">
      {metadata.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              {kind === 'text'
                ? "Un texte collé n'a pas de métadonnées : analysez le fichier d'origine (PDF, Word) pour en profiter."
                : 'Aucune métadonnée trouvée.'}
            </Text>
          }
        />
      ) : (
        <Table<MetaEntry>
          size="small"
          pagination={false}
          rowKey="key"
          showHeader={false}
          dataSource={metadata}
          columns={[
            {
              dataIndex: 'key',
              width: '38%',
              render: (k: string, m) => (
                <Text type={m.flagged ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                  {m.flagged && <WarningFilled style={{ marginRight: 4 }} />}
                  {k}
                </Text>
              ),
            },
            {
              dataIndex: 'value',
              render: (v: string, m) =>
                m.flagged ? (
                  <Tag color="red" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    {v}
                  </Tag>
                ) : (
                  <Text style={{ fontSize: 12, wordBreak: 'break-word' }}>{v}</Text>
                ),
            },
          ]}
        />
      )}
    </Card>
  );
}
