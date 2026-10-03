import { useCallback, useState } from 'react';
import { api } from '../api';
import type { AnalysisReport } from '../types';

export function useAnalysis(onDone?: () => void) {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (job: () => Promise<AnalysisReport>) => {
      setLoading(true);
      setError(null);
      try {
        const r = await job();
        setReport(r);
        onDone?.();

        setTimeout(() => document.getElementById('report')?.scrollIntoView({ behavior: 'smooth' }), 50);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [onDone],
  );

  return {
    report,
    loading,
    error,
    clearError: () => setError(null),
    reset: () => setReport(null),
    analyzeText: (text: string) => run(() => api.analyzeText(text)),
    analyzeFile: (file: File) => run(() => api.analyzeFile(file)),
    open: (id: string) => run(() => api.report(id)),
  };
}
