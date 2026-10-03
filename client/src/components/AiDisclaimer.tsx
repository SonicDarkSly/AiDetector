import { Alert } from 'antd';
import type { AnalysisReport } from '../types';

export function AiDisclaimer({ report }: { report: AnalysisReport | null }) {
  const model = report?.languageModel?.status === 'used' ? report.languageModel.name : null;
  return (
    <Alert
      type="warning"
      showIcon
      className="report-disclaimer"
      message={
        model
          ? `Une IA peut se tromper : la prévisibilité du texte est mesurée par ${model}. Ce résultat est une indication, pas une preuve.`
          : 'Une IA peut se tromper : chaque résultat est une indication, pas une preuve.'
      }
    />
  );
}
