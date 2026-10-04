import { useEffect, useState } from 'react';
import { Alert, Button, Flex, Popover, Radio, Select, Tooltip, Typography, message } from 'antd';
import { CheckCircleFilled, ReadOutlined } from '@ant-design/icons';
import { api } from '../api';
import type { AnalysisReport, Answer } from '../types';

const { Text } = Typography;

export const ANSWERS_CHANGED = 'mefiance-answers';

const VENDORS: [string, string][] = [
  ['chatgpt', 'ChatGPT'],
  ['gemini', 'Gemini'],
  ['claude', 'Claude'],
  ['mistral', 'Le Chat (Mistral)'],
  ['copilot', 'Copilot'],
  ['deepseek', 'DeepSeek'],
  ['perplexity', 'Perplexity'],
  ['grok', 'Grok'],
  ['meta', 'Meta AI'],
  ['qwen', 'Qwen'],
  ['autre', 'Autre ou inconnue'],
];
const vendorLabel = (v: string | null) => VENDORS.find(([k]) => k === v)?.[1] ?? 'IA';

function describe(answer: Answer): string {
  return answer.label === 'ai' ? `IA (${vendorLabel(answer.vendor)})` : 'humain';
}

export function KnownAnswer({ report }: { report: AnalysisReport }) {
  const usage = report.languageModel;
  const eligible = usage?.status === 'used' && usage.meanLogProb !== undefined;
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<Answer['label']>('ai');
  const [vendor, setVendor] = useState('chatgpt');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAnswer(null);
    if (!eligible) return;
    api
      .answer(report.id)
      .then(({ answer: a }) => {
        setAnswer(a);
        if (a) {
          setLabel(a.label);
          setVendor(a.vendor ?? 'autre');
        }
      })
      .catch(() => setAnswer(null));
  }, [report.id, eligible]);

  if (!eligible) {
    return (
      <Tooltip title="Possible seulement quand le modèle de langage a mesuré le texte (pas pour le code, un texte très court ou une ancienne analyse).">
        <Button type="link" size="small" disabled icon={<ReadOutlined />}>
          Apprentissage
        </Button>
      </Tooltip>
    );
  }

  const run = async (action: () => Promise<{ answer: Answer | null }>, done: string) => {
    setSaving(true);
    try {
      const { answer: a } = await action();
      setAnswer(a);
      setOpen(false);
      window.dispatchEvent(new Event(ANSWERS_CHANGED));
      void message.success(done);
    } catch (err) {
      void message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const outOfDomain = usage.domain === 'verse' || usage.domain === 'technical';
  const content = (
    <Flex vertical gap={10} style={{ width: 300 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Seulement si tu en es sûr. La réponse sert à recalibrer la mesure : seuls deux chiffres sont gardés
        (prévisibilité moyenne et longueur), jamais le texte.
      </Text>
      <Radio.Group
        value={label}
        onChange={(e) => setLabel(e.target.value as Answer['label'])}
        optionType="button"
        buttonStyle="solid"
        options={[
          { value: 'ai', label: 'Une IA' },
          { value: 'human', label: 'Un humain' },
        ]}
      />
      {label === 'ai' && (
        <Select
          value={vendor}
          onChange={setVendor}
          options={VENDORS.map(([value, text]) => ({ value, label: text }))}
        />
      )}
      {outOfDomain && (
        <Alert
          type="info"
          showIcon
          style={{ fontSize: 12 }}
          message={
            usage.domain === 'verse'
              ? 'Texte en vers : la réponse est gardée, mais ne sert pas au recalibrage (calibré sur la prose).'
              : 'Document technique : la réponse est gardée, mais ne sert pas au recalibrage (calibré sur la prose).'
          }
        />
      )}
      <Flex gap={8} justify="flex-end">
        {answer && (
          <Button
            size="small"
            danger
            loading={saving}
            onClick={() => void run(() => api.removeAnswer(report.id), 'Réponse retirée')}
          >
            Retirer
          </Button>
        )}
        <Button
          size="small"
          type="primary"
          loading={saving}
          onClick={() =>
            void run(
              () => api.setAnswer(report.id, label, label === 'ai' ? vendor : null),
              'Réponse enregistrée',
            )
          }
        >
          Enregistrer
        </Button>
      </Flex>
    </Flex>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      title="Apprentissage : d'où vient vraiment ce texte ?"
      content={content}
    >
      <Button
        type="link"
        size="small"
        icon={answer ? <CheckCircleFilled /> : <ReadOutlined />}
        className="known-answer"
      >
        {answer ? `Apprentissage : ${describe(answer)}` : 'Apprentissage'}
      </Button>
    </Popover>
  );
}
