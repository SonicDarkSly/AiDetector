import { useState } from 'react';
import { Col, Flex, Row, Segmented, Tooltip, Typography } from 'antd';
import { BarsOutlined, LayoutOutlined, ProfileOutlined } from '@ant-design/icons';
import type { AnalysisReport } from '../types';
import { VerdictCard } from './VerdictCard';
import { OriginCard } from './OriginCard';
import { SignalList } from './SignalList';
import { MetadataTable } from './MetadataTable';
import { StatsCard } from './StatsCard';
import { AnnotatedText } from './AnnotatedText';

const { Title } = Typography;

export type ReportLayout = 'columns' | 'list' | 'summary';

const STORAGE_KEY = 'aidetector-layout';
const LAYOUTS: { value: ReportLayout; label: string; icon: React.ReactNode }[] = [
  { value: 'columns', label: 'Deux colonnes', icon: <LayoutOutlined /> },
  { value: 'list', label: 'Une colonne, dans l’ordre de lecture', icon: <BarsOutlined /> },
  { value: 'summary', label: 'Résumé : verdict, outils et indices principaux', icon: <ProfileOutlined /> },
];

function savedLayout(): ReportLayout {
  const saved = localStorage.getItem(STORAGE_KEY);
  return LAYOUTS.some((l) => l.value === saved) ? (saved as ReportLayout) : 'columns';
}

export function ReportView({ report }: { report: AnalysisReport }) {
  const [layout, setLayout] = useState<ReportLayout>(savedLayout);
  const change = (value: ReportLayout) => {
    setLayout(value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  const verdict = <VerdictCard report={report} />;
  const origins = <OriginCard report={report} compact={layout === 'summary'} />;
  const signals = (
    <SignalList key={`signals-${report.id}`} signals={report.signals} mainOnly={layout === 'summary'} />
  );
  const metadata = <MetadataTable metadata={report.metadata} kind={report.source.kind} />;
  const stats = report.source.kind !== 'code' ? <StatsCard stats={report.stats} /> : null;
  const text = <AnnotatedText key={`text-${report.id}`} report={report} />;

  return (
    <div id="report">
      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0 }}>
          Résultat de l'analyse
        </Title>
        <Segmented
          value={layout}
          onChange={(v) => change(v as ReportLayout)}
          options={LAYOUTS.map((l) => ({
            value: l.value,
            icon: <Tooltip title={l.label}>{l.icon}</Tooltip>,
          }))}
        />
      </Flex>

      {layout === 'columns' && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <Flex vertical gap={16}>
              {verdict}
              {origins}
            </Flex>
          </Col>
          <Col xs={24} lg={14}>
            <Flex vertical gap={16}>
              {signals}
              {metadata}
            </Flex>
          </Col>
          {stats && <Col span={24}>{stats}</Col>}
          <Col span={24}>{text}</Col>
        </Row>
      )}

      {layout === 'list' && (
        <Flex vertical gap={16}>
          {verdict}
          {origins}
          {signals}
          {metadata}
          {stats}
          {text}
        </Flex>
      )}

      {layout === 'summary' && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Flex vertical gap={16}>
              {verdict}
              {origins}
            </Flex>
          </Col>
          <Col xs={24} lg={12}>
            {signals}
          </Col>
        </Row>
      )}
    </div>
  );
}
