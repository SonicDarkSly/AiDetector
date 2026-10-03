import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Col,
  ConfigProvider,
  Flex,
  Grid,
  Row,
  Space,
  Switch,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import { HistoryOutlined, MoonOutlined, QuestionCircleOutlined, SunOutlined } from '@ant-design/icons';
import frFR from 'antd/locale/fr_FR';
import { IA_GRADIENT, PRIMARY } from './constants';
import { useAnalysis } from './hooks/useAnalysis';
import { useHistory } from './hooks/useHistory';
import { InputPanel } from './components/InputPanel';
import { VerdictCard } from './components/VerdictCard';
import { OriginCard } from './components/OriginCard';
import { SignalList } from './components/SignalList';
import { MetadataTable } from './components/MetadataTable';
import { StatsCard } from './components/StatsCard';
import { AnnotatedText } from './components/AnnotatedText';
import { HistoryDrawer } from './components/HistoryDrawer';
import { HelpModal } from './components/HelpModal';

const { Title, Text } = Typography;

export default function App() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [dark, setDark] = useState(() => localStorage.getItem('aidetector-theme') === 'dark');
  useEffect(() => {
    localStorage.setItem('aidetector-theme', dark ? 'dark' : 'light');
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
            <svg
              width="36"
              height="36"
              viewBox="0 0 32 32"
              aria-label="AiDetector"
              style={{ flex: '0 0 auto' }}
            >
              <defs>
                <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#d52b1e" />
                  <stop offset=".5" stopColor="#b0179a" />
                  <stop offset="1" stopColor="#6d28d9" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="7" fill="url(#logo-g)" />
              <circle cx="14" cy="14" r="7" fill="none" stroke="#fff" strokeWidth="3" />
              <path d="M19 19l7 7" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
            </svg>
            <div>
              <Title
                level={3}
                style={{
                  margin: 0,
                  background: IA_GRADIENT,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  display: 'inline-block',
                }}
              >
                AiDetector
              </Title>
              <Text type="secondary" style={{ display: 'block' }}>
                Ce texte ou ce fichier vient-il d'une IA ? Métadonnées, traces de copier-coller, caractères
                cachés et style. 100 % local, sans IA.
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

        {report && (
          <div id="report">
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={10}>
                <Flex vertical gap={16}>
                  <VerdictCard report={report} />
                  <OriginCard report={report} />
                </Flex>
              </Col>
              <Col xs={24} lg={14}>
                <Flex vertical gap={16}>
                  <SignalList key={`signals-${report.id}`} signals={report.signals} />
                  <MetadataTable metadata={report.metadata} kind={report.source.kind} />
                </Flex>
              </Col>
              {report.source.kind !== 'code' && (
                <Col span={24}>
                  <StatsCard stats={report.stats} />
                </Col>
              )}
              <Col span={24}>
                <AnnotatedText key={`text-${report.id}`} report={report} />
              </Col>
            </Row>
          </div>
        )}
      </div>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        currentId={report?.id ?? null}
        onOpen={(id) => void analysis.open(id)}
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </ConfigProvider>
  );
}
