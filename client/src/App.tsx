import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  ConfigProvider,
  Flex,
  Grid,
  Space,
  Switch,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import { HistoryOutlined, MoonOutlined, QuestionCircleOutlined, SunOutlined } from '@ant-design/icons';
import frFR from 'antd/locale/fr_FR';
import { PRIMARY } from './constants';
import { useAnalysis } from './hooks/useAnalysis';
import { useHistory } from './hooks/useHistory';
import { InputPanel } from './components/InputPanel';
import { ReportView } from './components/ReportView';
import { HistoryDrawer } from './components/HistoryDrawer';
import { HelpModal } from './components/HelpModal';
import { Logo, Wordmark } from './components/Logo';
import { AnalysisOverlay } from './components/AnalysisOverlay';

const { Title, Text } = Typography;

export default function App() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [dark, setDark] = useState(() => localStorage.getItem('mefiance-theme') === 'dark');
  useEffect(() => {
    localStorage.setItem('mefiance-theme', dark ? 'dark' : 'light');
    document.body.style.background = dark ? '#0a0a0a' : '#f5f6f8';
  }, [dark]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const history = useHistory();
  const analysis = useAnalysis(history.refresh);
  const report = analysis.report;

  return (
    <ConfigProvider
      locale={frFR}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: PRIMARY,
          borderRadius: 8,
          ...(dark
            ? {
                colorBgContainer: '#26262a',
                colorTextSecondary: 'rgba(255,255,255,0.78)',
                colorTextTertiary: 'rgba(255,255,255,0.60)',
                colorTextQuaternary: 'rgba(255,255,255,0.45)',
                colorTextPlaceholder: 'rgba(255,255,255,0.48)',
              }
            : {
                colorTextSecondary: 'rgba(0,0,0,0.72)',
                colorTextTertiary: 'rgba(0,0,0,0.56)',
                colorTextQuaternary: 'rgba(0,0,0,0.42)',
                colorTextPlaceholder: 'rgba(0,0,0,0.45)',
              }),
        },
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px 64px' }}>
        <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 20 }}>
          <Flex align="center" gap={12}>
            <Logo />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                <Wordmark />
              </Title>
              <Text type="secondary" style={{ display: 'block' }}>
                Ce texte ou ce fichier vient-il d'une IA ? Analyse 100 % locale : rien ne sort de cette
                machine.
              </Text>
            </div>
          </Flex>
          <div style={isMobile ? { width: '100%', display: 'flex', justifyContent: 'center' } : undefined}>
            <Space size="middle">
              <Badge count={history.items.length} size="small" color={PRIMARY} overflowCount={99}>
                <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>
                  Historique
                </Button>
              </Badge>
              <Button icon={<QuestionCircleOutlined />} onClick={() => setHelpOpen(true)}>
                {isMobile ? '' : 'Comment ça marche ?'}
              </Button>
              <Tooltip title={dark ? 'Passer en thème clair' : 'Passer en thème sombre'}>
                <Switch
                  checked={dark}
                  onChange={setDark}
                  checkedChildren={<MoonOutlined />}
                  unCheckedChildren={<SunOutlined />}
                  aria-label="Thème sombre"
                />
              </Tooltip>
            </Space>
          </div>
        </Flex>

        <InputPanel
          loading={analysis.loading}
          dark={dark}
          onText={(t) => void analysis.analyzeText(t)}
          onFile={(f) => void analysis.analyzeFile(f)}
        />

        {analysis.error && (
          <Alert
            type="error"
            showIcon
            closable
            onClose={analysis.clearError}
            message={analysis.error}
            style={{ marginBottom: 16 }}
          />
        )}

        {report && <ReportView report={report} />}
      </div>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        currentId={report?.id ?? null}
        onOpen={(id) => void analysis.open(id)}
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AnalysisOverlay open={analysis.loading} dark={dark} />
    </ConfigProvider>
  );
}
