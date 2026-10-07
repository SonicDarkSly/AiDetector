import { useEffect, useState } from 'react';
import { Button, Card, Flex, Input, Tabs, Typography, Upload } from 'antd';
import {
  ClearOutlined,
  FileSearchOutlined,
  InboxOutlined,
  PlusOutlined,
  ScanOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { ACCEPT, IA_RING_GRADIENT } from '../constants';
import { ModelBadge } from './ModelBadge';

const { Text } = Typography;
const TAB_KEY = 'mefiance-input-tab';

interface Props {
  loading: boolean;
  dark: boolean;
  reportId: string | null;
  reportLabel: string | null;
  onText: (text: string) => void;
  onFile: (file: File) => void;
}

export function InputPanel({ loading, dark, reportId, reportLabel, onText, onFile }: Props) {
  const [text, setText] = useState('');
  const [folded, setFolded] = useState(false);

  // replié dès qu'un rapport s'affiche, pour laisser la place au résultat
  useEffect(() => {
    setFolded(reportId !== null);
  }, [reportId]);
  const [tab, setTab] = useState(() => localStorage.getItem(TAB_KEY) ?? 'text');
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;

  const textTab = (
    <Flex vertical gap={10}>
      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Collez ici le texte à vérifier (mail, devoir, lettre de motivation, article...). Collez-le tel quel : les caractères invisibles et la mise en forme copiée font partie des indices."
        autoSize={{ minRows: 7, maxRows: 18 }}
        disabled={loading}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && text.trim()) onText(text);
        }}
      />
      <Flex justify="space-between" align="center" wrap gap={8}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {words} mot{words > 1 ? 's' : ''} · {text.length} caractères
          {words > 0 && words < 120 ? ' · au-delà de 120 mots, les statistiques deviennent exploitables' : ''}
        </Text>
        <Flex gap={8}>
          <Button icon={<ClearOutlined />} onClick={() => setText('')} disabled={loading || !text}>
            Effacer
          </Button>
          <Button
            type="primary"
            icon={<ScanOutlined />}
            loading={loading}
            disabled={!text.trim()}
            onClick={() => onText(text)}
          >
            Analyser
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );

  const fileTab = (
    <Upload.Dragger
      accept={ACCEPT}
      multiple={false}
      showUploadList={false}
      disabled={loading}
      beforeUpload={(file) => {
        onFile(file);
        return false;
      }}
      style={{ padding: '12px 0' }}
    >
      <p style={{ margin: 0 }}>
        <InboxOutlined style={{ fontSize: 36, color: '#7c3aed' }} />
      </p>
      <p style={{ margin: '8px 0 4px', fontWeight: 500 }}>
        {loading ? 'Analyse en cours...' : 'Glissez un fichier ici ou cliquez pour le choisir'}
      </p>
      <Text type="secondary" style={{ fontSize: 12 }}>
        PDF · Word (.docx) · TXT · Markdown · code source (25 Mo max) · projet en .zip, avec son dossier .git
        (100 Mo max). Le fichier est analysé sur ce Mac et n'est envoyé nulle part.
      </Text>
    </Upload.Dragger>
  );

  return (
    <div
      style={{
        borderRadius: 16,
        padding: 2,
        background: IA_RING_GRADIENT,
        animation: loading ? 'iaSpin 1.6s linear infinite' : 'iaSpin 8s linear infinite',
        marginBottom: 24,
      }}
    >
      <Card
        style={{
          borderRadius: 14.5,
          border: 'none',
          background: dark ? '#1c1a22' : undefined,
        }}
        styles={{ body: { paddingTop: folded ? 12 : 4, paddingBottom: folded ? 12 : undefined } }}
      >
        {folded ? (
          <Flex justify="space-between" align="center" gap={12} wrap>
            <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
              <ScanOutlined style={{ color: '#7c3aed' }} />
              <Text type="secondary" ellipsis style={{ fontSize: 13 }}>
                Dernière analyse : <Text strong>{reportLabel ?? 'texte collé'}</Text>
              </Text>
            </Flex>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setFolded(false)}>
              Nouvelle analyse
            </Button>
          </Flex>
        ) : (
          <>
            <Tabs
              activeKey={tab}
              onChange={(k) => {
                setTab(k);
                localStorage.setItem(TAB_KEY, k);
              }}
              tabBarExtraContent={
                reportId ? (
                  <Button type="text" size="small" icon={<UpOutlined />} onClick={() => setFolded(true)}>
                    Replier
                  </Button>
                ) : null
              }
              items={[
                {
                  key: 'text',
                  label: (
                    <span>
                      <ScanOutlined /> Coller un texte
                    </span>
                  ),
                  children: textTab,
                },
                {
                  key: 'file',
                  label: (
                    <span>
                      <FileSearchOutlined /> Analyser un fichier
                    </span>
                  ),
                  children: fileTab,
                },
              ]}
            />
            <div className="model-footer">
              <ModelBadge busy={loading} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
