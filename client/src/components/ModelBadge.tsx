import { useEffect, useState } from 'react';
import { Flex, Tag, Tooltip, Typography } from 'antd';
import { ThunderboltFilled } from '@ant-design/icons';
import { api } from '../api';
import { IA_GRADIENT } from '../constants';
import type { LanguageModelInfo } from '../types';

const { Text } = Typography;

const STATUS: Record<LanguageModelInfo['status'], { label: string; color: string; hint: string }> = {
  ready: { label: 'en mémoire', color: 'green', hint: 'Chargé, la prochaine analyse est immédiate.' },
  idle: {
    label: 'prêt',
    color: 'blue',
    hint: 'Téléchargé, chargé au premier usage puis libéré après 10 min sans analyse.',
  },
  missing: {
    label: 'non téléchargé',
    color: 'orange',
    hint: 'Relancez avec le lanceur pour le télécharger (environ 1 Go, une seule fois).',
  },
  disabled: { label: 'désactivé', color: 'default', hint: 'Désactivé par MEFIANCE_MODEL=off.' },
  error: { label: 'erreur', color: 'red', hint: 'Chargement impossible : voir server/logs/access.log.' },
};

function size(bytes: number | null): string | null {
  if (!bytes) return null;
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2).replace('.', ',')} Go` : `${Math.round(bytes / 1e6)} Mo`;
}

export function ModelBadge({ refreshKey }: { refreshKey: unknown }) {
  const [info, setInfo] = useState<LanguageModelInfo | null>(null);

  useEffect(() => {
    api
      .model()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [refreshKey]);

  if (!info) return null;
  const status = STATUS[info.status];
  const specs = [
    info.parameters ? `${info.parameters} milliard${info.parameters === '1' ? '' : 's'} de paramètres` : null,
    info.quantization ? `quantification ${info.quantization}` : null,
    size(info.sizeBytes),
    `lit jusqu'à ${info.maxTokens} tokens`,
  ].filter(Boolean);

  return (
    <Flex align="center" gap={10} wrap className="model-badge">
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: IA_GRADIENT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
        }}
      >
        <ThunderboltFilled style={{ color: '#fff', fontSize: 13 }} />
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <Flex align="center" gap={6} wrap>
          <Text
            strong
            style={{
              fontSize: 13,
              background: IA_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Analyse IA locale
          </Text>
          <Tooltip title={status.hint}>
            <Tag color={status.color} style={{ marginInlineEnd: 0, cursor: 'help' }}>
              {status.label}
            </Tag>
          </Tooltip>
        </Flex>
        <Text type="secondary" style={{ fontSize: 11.5, display: 'block' }}>
          Modèle : {info.name ?? 'aucun'}
          {specs.length > 0 && ` · ${specs.join(' · ')}`}
        </Text>
      </div>
    </Flex>
  );
}
