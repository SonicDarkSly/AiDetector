import { useState, type ReactNode } from 'react';
import { Alert, Button, Col, Flex, Row, Segmented, Tooltip, Typography } from 'antd';
import {
  BarsOutlined,
  CheckOutlined,
  DragOutlined,
  HolderOutlined,
  LayoutOutlined,
  ProfileOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AnalysisReport } from '../types';
import { VerdictCard } from './VerdictCard';
import { OriginCard } from './OriginCard';
import { SignalList } from './SignalList';
import { MetadataTable } from './MetadataTable';
import { StatsCard } from './StatsCard';
import { AnnotatedText } from './AnnotatedText';

const { Title, Text } = Typography;

export type ReportLayout = 'columns' | 'list' | 'summary';
type BlockId = 'verdict' | 'origins' | 'signals' | 'metadata' | 'stats' | 'text';
type Zone = 'top' | 'left' | 'right' | 'full' | 'main';

const ZONES: Zone[] = ['top', 'left', 'right', 'full', 'main'];
type Arrangement = Partial<Record<Zone, BlockId[]>>;

const STORAGE_KEY = 'mefiance-layout';
const ARRANGEMENT_KEY = 'mefiance-arrangement';

const LAYOUTS: { value: ReportLayout; label: string; icon: ReactNode }[] = [
  { value: 'columns', label: 'Deux colonnes', icon: <LayoutOutlined /> },
  { value: 'list', label: 'Une colonne, dans l’ordre de lecture', icon: <BarsOutlined /> },
  { value: 'summary', label: 'Résumé : verdict, outils et indices principaux', icon: <ProfileOutlined /> },
];

const DEFAULTS: Record<ReportLayout, Arrangement> = {
  columns: { top: [], left: ['verdict', 'origins', 'stats'], right: ['signals', 'metadata'], full: ['text'] },
  list: { main: ['verdict', 'origins', 'signals', 'metadata', 'stats', 'text'] },
  summary: { top: [], left: ['verdict', 'origins'], right: ['signals'], full: [] },
};

const BLOCK_LABELS: Record<BlockId, string> = {
  verdict: 'Verdict',
  origins: 'Quel outil ?',
  signals: 'Indices détectés',
  metadata: 'Métadonnées',
  stats: 'Statistiques',
  text: 'Texte analysé',
};

const ZONE_LABELS: Record<Zone, string> = {
  top: 'Pleine largeur, en haut',
  left: 'Colonne gauche',
  right: 'Colonne droite',
  full: 'Pleine largeur, en bas',
  main: 'Ordre des blocs',
};

function savedLayout(): ReportLayout {
  const saved = localStorage.getItem(STORAGE_KEY);
  return LAYOUTS.some((l) => l.value === saved) ? (saved as ReportLayout) : 'columns';
}

function savedArrangement(layout: ReportLayout): Arrangement {
  const fallback = DEFAULTS[layout];
  try {
    const raw = localStorage.getItem(`${ARRANGEMENT_KEY}-${layout}`);
    const parsed = raw ? (JSON.parse(raw) as Arrangement) : null;
    if (!parsed) return fallback;
    const zones = Object.keys(fallback) as Zone[];
    const expected = zones.flatMap((z) => fallback[z] ?? []).sort();
    const found = zones.flatMap((z) => parsed[z] ?? []).sort();
    return JSON.stringify(expected) === JSON.stringify(found) ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

function zoneOf(arrangement: Arrangement, id: string): Zone | null {
  if (ZONES.includes(id as Zone)) return id as Zone;
  return (Object.keys(arrangement) as Zone[]).find((z) => arrangement[z]?.includes(id as BlockId)) ?? null;
}

function SortableBlock({ id, editing, children }: { id: BlockId; editing: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editing });
  if (children === null) return null;
  return (
    <div
      ref={setNodeRef}
      className={`report-block${editing ? ' editing' : ''}${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {editing && (
        <div className="report-block-handle" ref={setActivatorNodeRef} {...attributes} {...listeners}>
          <HolderOutlined /> {BLOCK_LABELS[id]}
        </div>
      )}
      <div className={editing ? 'report-block-body' : undefined}>{children}</div>
    </div>
  );
}

function DropZone({
  zone,
  ids,
  editing,
  render,
}: {
  zone: Zone;
  ids: BlockId[];
  editing: boolean;
  render: (id: BlockId, zone: Zone) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zone, disabled: !editing });
  if (!editing && ids.length === 0) return null;
  return (
    <SortableContext id={zone} items={ids} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={`report-zone${editing ? ' editing' : ''}${isOver ? ' over' : ''}`}>
        {editing && <Text className="report-zone-label">{ZONE_LABELS[zone]}</Text>}
        <Flex vertical gap={16}>
          {ids.map((id) => (
            <SortableBlock key={id} id={id} editing={editing}>
              {render(id, zone)}
            </SortableBlock>
          ))}
          {editing && ids.length === 0 && <div className="report-zone-empty">Déposez un bloc ici</div>}
        </Flex>
      </div>
    </SortableContext>
  );
}

export function ReportView({ report }: { report: AnalysisReport }) {
  const [layout, setLayout] = useState<ReportLayout>(savedLayout);
  const [arrangement, setArrangement] = useState<Arrangement>(() => savedArrangement(savedLayout()));
  const [editing, setEditing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const changeLayout = (value: ReportLayout) => {
    setLayout(value);
    setArrangement(savedArrangement(value));
    localStorage.setItem(STORAGE_KEY, value);
  };

  const save = (next: Arrangement) => {
    setArrangement(next);
    localStorage.setItem(`${ARRANGEMENT_KEY}-${layout}`, JSON.stringify(next));
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = zoneOf(arrangement, String(active.id));
    const to = zoneOf(arrangement, String(over.id));
    if (!from || !to || from === to) return;
    const source = (arrangement[from] ?? []).filter((id) => id !== active.id);
    const target = [...(arrangement[to] ?? [])];
    const at = target.indexOf(over.id as BlockId);
    target.splice(at < 0 ? target.length : at, 0, active.id as BlockId);
    save({ ...arrangement, [from]: source, [to]: target });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const zone = zoneOf(arrangement, String(active.id));
    if (!zone || zone !== zoneOf(arrangement, String(over.id))) return;
    const ids = arrangement[zone] ?? [];
    const from = ids.indexOf(active.id as BlockId);
    const to = ids.indexOf(over.id as BlockId);
    if (from >= 0 && to >= 0 && from !== to) save({ ...arrangement, [zone]: arrayMove(ids, from, to) });
  };

  const summary = layout === 'summary';
  const render = (id: BlockId, zone: Zone): ReactNode => {
    const narrow = zone === 'left' || zone === 'right';
    switch (id) {
      case 'verdict':
        return <VerdictCard report={report} />;
      case 'origins':
        return <OriginCard report={report} compact={summary} />;
      case 'signals':
        return <SignalList key={`signals-${report.id}`} signals={report.signals} mainOnly={summary} />;
      case 'metadata':
        return report.source.kind !== 'text' ? (
          <MetadataTable metadata={report.metadata} kind={report.source.kind} />
        ) : null;
      case 'stats':
        return report.source.kind !== 'code' ? <StatsCard stats={report.stats} compact={narrow} /> : null;
      case 'text':
        return <AnnotatedText key={`text-${report.id}`} report={report} />;
    }
  };

  const zone = (z: Zone) => (
    <DropZone zone={z} ids={arrangement[z] ?? []} editing={editing} render={render} />
  );
  const warnings = report.metadata.filter((m) => m.key === 'Avertissement').map((m) => m.value);

  return (
    <div id="report">
      {warnings.map((w) => (
        <Alert
          key={w}
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Analyse incomplète"
          description={w}
        />
      ))}
      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0 }}>
          Résultat de l'analyse
        </Title>
        <Flex gap={8} align="center" wrap>
          {editing && (
            <Button size="small" icon={<UndoOutlined />} onClick={() => save(DEFAULTS[layout])}>
              Disposition d'origine
            </Button>
          )}
          <Tooltip
            title={
              editing
                ? undefined
                : layout === 'list'
                  ? 'Réordonner les blocs'
                  : 'Déplacer les blocs entre les colonnes et la pleine largeur'
            }
          >
            <Button
              size="small"
              type={editing ? 'primary' : 'default'}
              icon={editing ? <CheckOutlined /> : <DragOutlined />}
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? 'Terminé' : 'Organiser'}
            </Button>
          </Tooltip>
          <Segmented
            value={layout}
            onChange={(v) => changeLayout(v as ReportLayout)}
            options={LAYOUTS.map((l) => ({
              value: l.value,
              icon: <Tooltip title={l.label}>{l.icon}</Tooltip>,
            }))}
          />
        </Flex>
      </Flex>
      {editing && (
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 10 }}>
          {layout === 'list'
            ? 'Faites glisser un bloc par sa poignée pour changer l’ordre.'
            : 'Faites glisser un bloc par sa poignée : pleine largeur en haut, colonne gauche, colonne droite ou pleine largeur en bas.'}
        </Text>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {layout === 'list' ? (
          zone('main')
        ) : (
          <Row gutter={[16, 16]}>
            {(editing || (arrangement.top ?? []).length > 0) && <Col span={24}>{zone('top')}</Col>}
            <Col xs={24} lg={summary ? 12 : 10}>
              {zone('left')}
            </Col>
            <Col xs={24} lg={summary ? 12 : 14}>
              {zone('right')}
            </Col>
            {(editing || (arrangement.full ?? []).length > 0) && <Col span={24}>{zone('full')}</Col>}
          </Row>
        )}
      </DndContext>
    </div>
  );
}
