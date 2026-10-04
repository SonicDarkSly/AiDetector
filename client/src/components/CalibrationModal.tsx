import { Alert, Button, Flex, Modal, Popconfirm, Progress, Table, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import { api } from '../api';
import type { CalibrationStatus, MeasuredRate } from '../types';
import { formatDate } from '../utils/format';

const { Paragraph, Text, Title } = Typography;

const VENDOR_NAMES: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  mistral: 'Le Chat',
  copilot: 'Copilot',
  deepseek: 'DeepSeek',
  perplexity: 'Perplexity',
  grok: 'Grok',
  meta: 'Meta AI',
  qwen: 'Qwen',
  autre: 'autre',
};

const pct = (x: number) => `${Math.round(x * 100)} %`;

function RatesTable({ current, proposed }: { current: MeasuredRate[]; proposed?: MeasuredRate[] }) {
  const rows = current.map((c) => ({ ...c, next: proposed?.find((p) => p.tokens === c.tokens) }));
  return (
    <Table
      size="small"
      pagination={false}
      rowKey="tokens"
      dataSource={rows}
      columns={[
        { title: 'Longueur', dataIndex: 'tokens', render: (t: number) => `${t} tokens` },
        {
          title: proposed ? 'Actuelle : IA repérées / humains à tort' : 'IA repérées / humains à tort',
          render: (_, r) => `${pct(r.detected)} / ${pct(r.falsePositives)}`,
        },
        ...(proposed
          ? [
              {
                title: 'Proposée : IA repérées / humains à tort',
                render: (_: unknown, r: (typeof rows)[number]) =>
                  r.next ? `${pct(r.next.detected)} / ${pct(r.next.falsePositives)}` : '—',
              },
            ]
          : []),
      ]}
    />
  );
}

export function CalibrationModal({
  open,
  status,
  onClose,
  onChanged,
}: {
  open: boolean;
  status: CalibrationStatus | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!status) return null;
  const { active, answers, minimum, proposal } = status;
  const given = answers.ai + answers.human;

  const act = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      void message.success(done);
      onChanged();
    } catch (err) {
      void message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Calibration du modèle" width={680}>
      <Paragraph>
        {active.origin === 'origine' ? (
          <>
            Calibration <Text strong>d'origine</Text> : {active.texts.ai + active.texts.human} textes (
            {active.texts.ai} IA, {active.texts.human} humains).
          </>
        ) : (
          <>
            Calibration <Text strong>personnalisée</Text>
            {active.appliedAt ? ` depuis le ${formatDate(active.appliedAt)}` : ''} :{' '}
            {active.texts.ai + active.texts.human} textes, dont {active.answers} de tes réponses.
          </>
        )}
      </Paragraph>

      <Title level={5}>Tes réponses</Title>
      <Flex gap={6} wrap align="center" style={{ marginBottom: 8 }}>
        <Tag color="volcano">{answers.ai} IA</Tag>
        <Tag color="green">{answers.human} humain</Tag>
        {Object.entries(answers.vendors).map(([v, n]) => (
          <Tag key={v} bordered={false}>
            {VENDOR_NAMES[v] ?? v} : {n}
          </Tag>
        ))}
        {answers.unused > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            + {answers.unused} sur des poèmes ou documents techniques, non utilisées
          </Text>
        )}
      </Flex>
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        Pour répondre, utilise « Apprentissage » en bas du verdict, uniquement quand tu sais d'où vient le
        texte. Chaque réponse compte autant qu'un texte du corpus d'origine.
      </Paragraph>

      {!proposal ? (
        <>
          <Progress
            percent={Math.min(100, Math.round((given / minimum) * 100))}
            format={() => `${given} / ${minimum}`}
          />
          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            Encore {Math.max(0, minimum - given)} réponse(s) sur de la prose avant de pouvoir proposer un
            recalibrage. Taux de la calibration utilisée :
          </Paragraph>
          <RatesTable current={active.rates} />
        </>
      ) : (
        <>
          <Title level={5}>Recalibrage proposé</Title>
          <RatesTable current={proposal.current.rates} proposed={proposal.calibration.rates} />
          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            Les deux colonnes sont mesurées de la même façon (validation croisée), d'où de petits écarts avec
            les taux affichés ailleurs.
          </Paragraph>
          <Paragraph>
            Sur tes {proposal.answersUsed} réponses, la calibration actuelle en classe correctement{' '}
            <Text strong>{proposal.current.correct}</Text>, la proposée{' '}
            <Text strong>{proposal.proposed.correct}</Text> (mesuré sans que chaque réponse serve à son propre
            calcul).
          </Paragraph>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Des taux plus bas ne sont pas un défaut : ils viennent de textes plus variés que le corpus d'origine, donc d'une mesure plus réaliste. N'applique que si le résultat sur tes réponses est meilleur."
          />
          <Popconfirm
            title="Appliquer cette calibration ?"
            description="Les prochaines analyses l'utiliseront. Tu pourras revenir à l'origine."
            okText="Appliquer"
            cancelText="Annuler"
            onConfirm={() => void act(() => api.applyCalibration(), 'Calibration appliquée')}
          >
            <Button type="primary" loading={busy}>
              Appliquer la calibration proposée
            </Button>
          </Popconfirm>
        </>
      )}

      {active.origin === 'personnalisée' && (
        <Button
          style={{ marginTop: 12, marginLeft: proposal ? 8 : 0 }}
          loading={busy}
          onClick={() => void act(() => api.resetCalibration(), "Calibration d'origine rétablie")}
        >
          Revenir à la calibration d'origine
        </Button>
      )}
    </Modal>
  );
}
