import { Card, Col, Row, Statistic, Tooltip } from 'antd';
import type { TextStats } from '../types';

interface Item {
  title: string;
  value: string | number;
  hint: string;
  warn?: boolean;
}

export function StatsCard({ stats, compact = false }: { stats: TextStats; compact?: boolean }) {
  const items: Item[] = [
    { title: 'Mots', value: stats.words, hint: 'Nombre de mots analysés.' },
    { title: 'Phrases', value: stats.sentences, hint: 'Phrases de 3 mots ou plus (titres courts ignorés).' },
    { title: 'Mots / phrase', value: stats.avgSentenceLength, hint: 'Longueur moyenne des phrases.' },
    {
      title: 'Variation des phrases',
      value: stats.sentenceLengthCv,
      hint: '« Burstiness » : écart-type / moyenne des longueurs de phrases. Humain : souvent > 0,5. Texte généré : souvent 0,3-0,45. Fiable seulement au-delà de ~120 mots.',
      warn: stats.sentences >= 8 && stats.sentenceLengthCv < 0.4,
    },
    {
      title: 'Diversité lexicale',
      value: stats.lexicalDiversity,
      hint: 'MATTR (fenêtre de 50 mots) : part de mots différents. Information seulement, peu discriminante.',
    },
    {
      title: 'Tirets longs (pour 1000 mots)',
      value: stats.emDashPer1000,
      hint: 'Tiret cadratin, absent des claviers : très utilisé par ChatGPT.',
      warn: stats.emDashPer1000 >= 4 && stats.words >= 250,
    },
    {
      title: 'Lignes en liste',
      value: `${Math.round(stats.bulletLineRatio * 100)} %`,
      hint: 'Part des lignes qui sont des puces / numéros.',
    },
    { title: 'Paragraphes', value: stats.paragraphs, hint: 'Blocs séparés par une ligne vide.' },
  ];
  return (
    <Card size="small" title="Statistiques du texte">
      <Row gutter={[12, 12]}>
        {items.map((it) => (
          <Col key={it.title} xs={12} sm={6} lg={compact ? 12 : 3}>
            <Tooltip title={it.hint}>
              <div style={{ cursor: 'help' }}>
                <Statistic
                  title={
                    <span
                      style={
                        compact
                          ? {
                              fontSize: 11,
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }
                          : { fontSize: 11 }
                      }
                    >
                      {it.title}
                    </span>
                  }
                  value={it.value}
                  valueStyle={{ fontSize: 18, color: it.warn ? '#fa8c16' : undefined }}
                />
              </div>
            </Tooltip>
          </Col>
        ))}
      </Row>
    </Card>
  );
}
