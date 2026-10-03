import { useState, type ReactNode } from 'react';
import { Alert, Button, Flex, Segmented, Tooltip, Typography } from 'antd';
import {
  AppstoreOutlined,
  BarsOutlined,
  CheckOutlined,
  DragOutlined,
  HolderOutlined,
  ProfileOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
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
interface Cell {
  id: string;
  blocks: BlockId[];
}
interface GridRow {
  id: string;
  cells: Cell[];
}

const STORAGE_KEY = 'mefiance-layout';
const GRID_KEY = 'mefiance-grid';
const MAX_CELLS = 3;
const NEW_ROW = 'new-row:';
const NEW_CELL = 'new-cell:';

const LAYOUTS: { value: ReportLayout; label: string; icon: ReactNode }[] = [
  { value: 'columns', label: 'Grille : lignes et colonnes', icon: <AppstoreOutlined /> },
  { value: 'list', label: 'Une colonne, dans l’ordre de lecture', icon: <BarsOutlined /> },
  { value: 'summary', label: 'Résumé : verdict, outils et indices principaux', icon: <ProfileOutlined /> },
];

const BLOCK_LABELS: Record<BlockId, string> = {
  verdict: 'Verdict',
  origins: 'Quel outil ?',
  signals: 'Indices détectés',
  metadata: 'Métadonnées',
  stats: 'Statistiques',
  text: 'Texte analysé',
};

const uid = () => Math.random().toString(36).slice(2, 10);
const row = (...cells: BlockId[][]): GridRow => ({
  id: `r-${uid()}`,
  cells: cells.map((blocks) => ({ id: `c-${uid()}`, blocks })),
});

const DEFAULTS: Record<ReportLayout, () => GridRow[]> = {
  columns: () => [row(['verdict', 'origins', 'stats'], ['signals', 'metadata']), row(['text'])],
  list: () => [row(['verdict', 'origins', 'signals', 'metadata', 'stats', 'text'])],
  summary: () => [row(['verdict', 'origins'], ['signals'])],
};

function savedLayout(): ReportLayout {
  const saved = localStorage.getItem(STORAGE_KEY);
  return LAYOUTS.some((l) => l.value === saved) ? (saved as ReportLayout) : 'columns';
}

const blocksOf = (grid: GridRow[]) => grid.flatMap((r) => r.cells.flatMap((c) => c.blocks));

function savedGrid(layout: ReportLayout): GridRow[] {
  const fallback = DEFAULTS[layout]();
  try {
    const raw = localStorage.getItem(`${GRID_KEY}-${layout}`);
    const parsed = raw ? (JSON.parse(raw) as GridRow[]) : null;
    if (!Array.isArray(parsed)) return fallback;
    const same = JSON.stringify(blocksOf(parsed).sort()) === JSON.stringify(blocksOf(fallback).sort());
    const valid = parsed.every((r) => r.cells.length >= 1 && r.cells.length <= MAX_CELLS);
    return same && valid ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function cleanup(grid: GridRow[]): GridRow[] {
  return grid
    .map((r) => ({ ...r, cells: r.cells.filter((c) => c.blocks.length > 0) }))
    .filter((r) => r.cells.length > 0);
}

function cellOf(grid: GridRow[], id: string): Cell | null {
  for (const r of grid)
    for (const c of r.cells) if (c.id === id || c.blocks.includes(id as BlockId)) return c;
  return null;
}

function withoutBlock(grid: GridRow[], block: BlockId): GridRow[] {
  return grid.map((r) => ({
    ...r,
    cells: r.cells.map((c) => ({ ...c, blocks: c.blocks.filter((b) => b !== block) })),
  }));
}

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

function SortableBlock({ id, editing, children }: { id: BlockId; editing: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editing });
  if (children === null && !editing) return null;
  return (
    <div
      ref={setNodeRef}
      className={`report-block${editing ? ' editing' : ''}${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {editing && (
        <div className="report-block-handle" ref={setActivatorNodeRef} {...attributes} {...listeners}>
          <HolderOutlined /> {BLOCK_LABELS[id]}
        </div>
      )}
      {children === null ? (
        <div className="report-block-hidden">Masqué pour ce type d’analyse</div>
      ) : (
        <div className={editing ? 'report-block-body' : 'report-block-content'}>{children}</div>
      )}
    </div>
  );
}

function CellZone({
  cell,
  editing,
  render,
}: {
  cell: Cell;
  editing: boolean;
  render: (id: BlockId) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cell.id, disabled: !editing });
  if (!editing && cell.blocks.every((id) => render(id) === null)) return null;
  return (
    <SortableContext id={cell.id} items={cell.blocks} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={`report-cell${editing ? ' editing' : ''}${isOver ? ' over' : ''}`}>
        <Flex vertical gap={16} className="report-cell-stack">
          {cell.blocks.map((id) => (
            <SortableBlock key={id} id={id} editing={editing}>
              {render(id)}
            </SortableBlock>
          ))}
        </Flex>
      </div>
    </SortableContext>
  );
}

function NewTarget({ id, label, vertical = false }: { id: string; label: string; vertical?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`report-new${vertical ? ' vertical' : ''}${isOver ? ' over' : ''}`}>
      <span>{label}</span>
    </div>
  );
}

export function ReportView({ report }: { report: AnalysisReport }) {
  const [layout, setLayout] = useState<ReportLayout>(savedLayout);
  const [grid, setGrid] = useState<GridRow[]>(() => savedGrid(savedLayout()));
  const [editing, setEditing] = useState(false);
  const freeLayout = layout !== 'list';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const changeLayout = (value: ReportLayout) => {
    setLayout(value);
    setGrid(savedGrid(value));
    localStorage.setItem(STORAGE_KEY, value);
  };

  const save = (next: GridRow[]) => {
    setGrid(next);
    localStorage.setItem(`${GRID_KEY}-${layout}`, JSON.stringify(next));
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const overId = String(over.id);
    if (overId.startsWith(NEW_ROW) || overId.startsWith(NEW_CELL)) return;
    const from = cellOf(grid, String(active.id));
    const to = cellOf(grid, overId);
    if (!from || !to || from.id === to.id) return;
    const block = active.id as BlockId;
    const target = to.blocks.filter((b) => b !== block);
    const at = target.indexOf(overId as BlockId);
    target.splice(at < 0 ? target.length : at, 0, block);
    setGrid(
      withoutBlock(grid, block).map((r) => ({
        ...r,
        cells: r.cells.map((c) => (c.id === to.id ? { ...c, blocks: target } : c)),
      })),
    );
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const block = active.id as BlockId;
    if (!over) return save(cleanup(grid));
    const overId = String(over.id);
    if (overId.startsWith(NEW_ROW)) {
      const index = Number(overId.slice(NEW_ROW.length));
      const next = withoutBlock(grid, block);
      next.splice(index, 0, row([block]));
      return save(cleanup(next));
    }
    if (overId.startsWith(NEW_CELL)) {
      const rowId = overId.slice(NEW_CELL.length);
      const next = withoutBlock(grid, block).map((r) =>
        r.id === rowId ? { ...r, cells: [...r.cells, { id: `c-${uid()}`, blocks: [block] }] } : r,
      );
      return save(cleanup(next));
    }
    const cell = cellOf(grid, block);
    if (cell && cell.id === cellOf(grid, overId)?.id) {
      const from = cell.blocks.indexOf(block);
      const to = cell.blocks.indexOf(overId as BlockId);
      if (from >= 0 && to >= 0 && from !== to) {
        const moved = arrayMove(cell.blocks, from, to);
        return save(
          cleanup(
            grid.map((r) => ({
              ...r,
              cells: r.cells.map((c) => (c.id === cell.id ? { ...c, blocks: moved } : c)),
            })),
          ),
        );
      }
    }
    save(cleanup(grid));
  };

  const summary = layout === 'summary';
  const render = (id: BlockId, narrow: boolean): ReactNode => {
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

  const warnings = report.metadata.filter((m) => m.key === 'Avertissement').map((m) => m.value);
  const showNew = editing && freeLayout;

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
            <Button size="small" icon={<UndoOutlined />} onClick={() => save(DEFAULTS[layout]())}>
              Disposition d'origine
            </Button>
          )}
          <Tooltip
            title={
              editing
                ? undefined
                : freeLayout
                  ? 'Placer les blocs en lignes et colonnes'
                  : 'Réordonner les blocs'
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
          {freeLayout
            ? 'Faites glisser un bloc par sa poignée : dans une case, à côté d’un autre bloc (jusqu’à 3 par ligne), ou sur une barre « Nouvelle ligne » pour lui donner toute la largeur.'
            : 'Faites glisser un bloc par sa poignée pour changer l’ordre.'}
        </Text>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <Flex vertical gap={16}>
          {showNew && <NewTarget id={`${NEW_ROW}0`} label="Nouvelle ligne" />}
          {grid.map((r, i) => (
            <Flex vertical gap={16} key={r.id}>
              <div className={`report-row${editing ? ' editing' : ''}`}>
                {r.cells.map((cell) => (
                  <CellZone
                    key={cell.id}
                    cell={cell}
                    editing={editing}
                    render={(id) => render(id, r.cells.length > 1)}
                  />
                ))}
                {showNew && r.cells.length < MAX_CELLS && (
                  <NewTarget id={`${NEW_CELL}${r.id}`} label="Nouvelle colonne" vertical />
                )}
              </div>
              {showNew && <NewTarget id={`${NEW_ROW}${i + 1}`} label="Nouvelle ligne" />}
            </Flex>
          ))}
        </Flex>
      </DndContext>
    </div>
  );
}
