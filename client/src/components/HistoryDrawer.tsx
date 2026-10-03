import { Button, Drawer, Empty, Flex, List, Popconfirm, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { useHistory } from '../hooks/useHistory';
import { KIND_LABELS, scoreColor } from '../constants';
import { formatDate } from '../utils/format';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  history: ReturnType<typeof useHistory>;
  currentId: string | null;
  onOpen: (id: string) => void;
}

export function HistoryDrawer({ open, onClose, history, currentId, onOpen }: Props) {
  return (
    <Drawer
      title="Historique des analyses"
      open={open}
      onClose={onClose}
      width={Math.min(460, window.innerWidth)}
      extra={
        history.items.length > 0 && (
          <Popconfirm
            title="Effacer tout l'historique ?"
            okText="Effacer"
            cancelText="Annuler"
            okButtonProps={{ danger: true }}
            onConfirm={() => void history.clear()}
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              Tout effacer
            </Button>
          </Popconfirm>
        )
      }
    >
      {history.items.length === 0 ? (
        <Empty description="Aucune analyse pour l'instant." />
      ) : (
        <List
          loading={history.loading}
          dataSource={history.items}
          renderItem={(it) => (
            <List.Item
              style={{
                cursor: 'pointer',
                borderRadius: 8,
                padding: '10px 8px',
                background: it.id === currentId ? 'rgba(124,58,237,0.08)' : undefined,
              }}
              onClick={() => {
                onOpen(it.id);
                onClose();
              }}
              actions={[
                <Popconfirm
                  key="del"
                  title="Supprimer cette analyse ?"
                  okText="Supprimer"
                  cancelText="Annuler"
                  okButtonProps={{ danger: true }}
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    void history.remove(it.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Tooltip title="Supprimer">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Tooltip>
                </Popconfirm>,
              ]}
            >
              <Flex gap={10} align="flex-start" style={{ minWidth: 0, width: '100%' }}>
                <Tag
                  style={{
                    background: it.undetermined ? '#8c8c8c' : scoreColor(it.score),
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    minWidth: 46,
                    textAlign: 'center',
                  }}
                >
                  {it.undetermined ? '?' : `${it.score} %`}
                </Tag>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text strong ellipsis style={{ display: 'block' }}>
                    {it.filename ?? KIND_LABELS[it.kind]}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    {formatDate(it.analyzedAt)} · {it.verdict}
                    {it.topVendor ? ` · ${it.topVendor}` : ''}
                  </Text>
                  <Text type="secondary" ellipsis style={{ fontSize: 11, display: 'block', opacity: 0.8 }}>
                    {it.excerpt}
                  </Text>
                </div>
              </Flex>
            </List.Item>
          )}
        />
      )}
    </Drawer>
  );
}
