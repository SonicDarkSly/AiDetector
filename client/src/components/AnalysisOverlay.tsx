import { useEffect, useState } from 'react';
import { Progress, Spin, Typography } from 'antd';
import { CheckCircleFilled, ClockCircleOutlined } from '@ant-design/icons';
import { Logo } from './Logo';
import { activityLabel, useModelActivity } from '../hooks/useModelActivity';
import type { ActiveModel, ModelActivity } from '../types';

const { Text } = Typography;

const STEPS = [
  'Lecture du contenu',
  'Recherche des traces techniques',
  'Mesure de la prévisibilité du texte',
  'Calcul du verdict',
];

const GPU_LABELS: Record<string, string> = {
  metal: 'GPU Apple (Metal)',
  cuda: 'GPU NVIDIA (CUDA)',
  vulkan: 'GPU (Vulkan)',
};

const gigabytes = (bytes: number) => `${(bytes / 1e9).toFixed(1).replace('.', ',')}\u00a0Go`;

function roleOf(model: ActiveModel, binoculars: boolean): { title: string; task: string } {
  if (model.role === 'observer')
    return {
      title: 'Observateur Binoculars',
      task: "Lit le texte et note, à chaque mot, ce qu'il s'attendait à trouver.",
    };
  return {
    title: 'Modèle de mesure',
    task: binoculars
      ? "Mesure la probabilité de chaque mot écrit et la compare aux attentes de l'observateur."
      : 'Mesure la probabilité de chaque mot écrit.',
  };
}

function stateOf(model: ActiveModel, activity: ModelActivity): 'busy' | 'done' | 'waiting' {
  // chargement : le modèle de mesure d'abord, puis l'observateur
  if (activity.phase === 'loading') {
    if (model.progress >= 1) return 'done';
    return model.progress > 0 || model.role === 'performer' ? 'busy' : 'waiting';
  }
  if (activity.phase === 'observing') return model.role === 'observer' ? 'busy' : 'waiting';
  return model.role === 'observer' ? 'done' : 'busy';
}

function ModelRow({ model, activity }: { model: ActiveModel; activity: ModelActivity }) {
  const binoculars = activity.models.some((m) => m.role === 'observer');
  const { title, task } = roleOf(model, binoculars);
  const state = stateOf(model, activity);
  return (
    <div className={`analysis-model-row ${state}`}>
      <span className="analysis-model-state">
        {state === 'busy' ? (
          <Spin size="small" />
        ) : state === 'done' ? (
          <CheckCircleFilled />
        ) : (
          <ClockCircleOutlined />
        )}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="analysis-model-name">
          {model.name}
          <span className="analysis-model-role">{title}</span>
        </div>
        <div className="analysis-model-task">
          {activity.phase === 'loading' ? 'Chargement en mémoire, quelques secondes au premier usage.' : task}
          {model.sizeBytes ? ` · ${gigabytes(model.sizeBytes)}\u00a0en\u00a0mémoire` : ''}
        </div>
        <Progress
          className="analysis-model-progress"
          percent={state === 'done' ? 100 : Math.round(model.progress * 100)}
          status={state === 'done' ? 'success' : state === 'busy' ? 'active' : 'normal'}
          strokeColor={state === 'done' ? undefined : { from: '#b0179a', to: '#7c3aed' }}
          size="small"
        />
      </div>
    </div>
  );
}

export function AnalysisOverlay({ open, dark }: { open: boolean; dark: boolean }) {
  const [step, setStep] = useState(0);
  const [now, setNow] = useState(Date.now());
  const activity = useModelActivity(open);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    const clock = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [open]);

  if (!open) return null;
  const memory = activity?.models.reduce((a, m) => a + (m.sizeBytes ?? 0), 0) ?? 0;
  const details = activity
    ? [
        activity.steps > 1 && activity.step > 0 ? `étape ${activity.step} sur ${activity.steps}` : null,
        activity.gpu ? (GPU_LABELS[activity.gpu] ?? `GPU (${activity.gpu})`) : null,
        memory ? `modèles en mémoire : ${gigabytes(memory)}` : null,
        `${Math.max(0, (now - activity.since) / 1000)
          .toFixed(1)
          .replace('.', ',')} s`,
      ].filter(Boolean)
    : [];

  return (
    <div className={`analysis-overlay ${dark ? 'dark' : ''}`} role="status" aria-live="polite">
      <div className="analysis-box">
        <div className="analysis-ring">
          <Logo size={44} />
        </div>
        <Text strong style={{ fontSize: 15 }}>
          Analyse en cours…
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {activity ? activityLabel(activity) : STEPS[step]}
        </Text>
        {activity && (
          <>
            <div className="analysis-models">
              {[...activity.models]
                .sort((a, b) => (a.role === 'observer' ? -1 : 0) - (b.role === 'observer' ? -1 : 0))
                .map((m) => (
                  <ModelRow key={m.role} model={m} activity={activity} />
                ))}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {details.join(' · ')}
            </Text>
          </>
        )}
      </div>
    </div>
  );
}
