import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ModelActivity } from '../types';

const POLL_MS = 250;

export function useModelActivity(active: boolean): ModelActivity | null {
  const [activity, setActivity] = useState<ModelActivity | null>(null);

  useEffect(() => {
    if (!active) {
      setActivity(null);
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      api
        .modelActivity()
        .then((r) => !stopped && setActivity(r.activity))
        .catch(() => undefined)
        .finally(() => {
          if (!stopped) timer = setTimeout(tick, POLL_MS);
        });
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active]);

  return activity;
}

export function activityLabel(activity: ModelActivity): string {
  if (activity.phase === 'loading') return 'Chargement du modèle en mémoire';
  return activity.tokens
    ? `Mesure de la prévisibilité sur ${activity.tokens} tokens`
    : 'Mesure de la prévisibilité';
}
