import { useEffect, useState } from 'react';
import { Spin, Typography } from 'antd';
import { Logo } from './Logo';
import { activityLabel, useModelActivity } from '../hooks/useModelActivity';

const { Text } = Typography;

const STEPS = [
  'Lecture du contenu',
  'Recherche des traces techniques',
  'Mesure de la prévisibilité du texte',
  'Calcul du verdict',
];

export function AnalysisOverlay({ open, dark }: { open: boolean; dark: boolean }) {
  const [step, setStep] = useState(0);
  const activity = useModelActivity(open);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;
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
          <div className="analysis-model">
            <Spin size="small" />
            <span>
              {activity.model}
              {activity.phase === 'loading' ? ' : quelques secondes au premier usage' : ' au travail'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
