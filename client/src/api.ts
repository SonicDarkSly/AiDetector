import type {
  AnalysisReport,
  Answer,
  Calibration,
  CalibrationStatus,
  LanguageModelInfo,
  ModelActivity,
  ReportSummary,
} from './types';

async function asJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) {
    const msg = data.error ?? (typeof data.message === 'string' ? data.message : null);
    throw new Error(msg ?? `Erreur serveur (${res.status})`);
  }
  return data as T;
}

export const api = {
  analyzeText: (text: string) =>
    fetch('/api/analyze/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then((r) => asJson<AnalysisReport>(r)),

  analyzeFile: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch('/api/analyze/file', { method: 'POST', body: fd }).then((r) => asJson<AnalysisReport>(r));
  },

  model: () => fetch('/api/model').then((r) => asJson<LanguageModelInfo>(r)),
  modelActivity: () =>
    fetch('/api/model/activity').then((r) => asJson<{ activity: ModelActivity | null }>(r)),
  answer: (id: string) =>
    fetch(`/api/reports/${id}/answer`).then((r) => asJson<{ answer: Answer | null }>(r)),
  setAnswer: (id: string, label: Answer['label'], vendor: string | null) =>
    fetch(`/api/reports/${id}/answer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, vendor }),
    }).then((r) => asJson<{ answer: Answer | null }>(r)),
  removeAnswer: (id: string) =>
    fetch(`/api/reports/${id}/answer`, { method: 'DELETE' }).then((r) => asJson<{ answer: null }>(r)),
  calibration: () => fetch('/api/calibration').then((r) => asJson<CalibrationStatus>(r)),
  applyCalibration: () =>
    fetch('/api/calibration/apply', { method: 'POST' }).then((r) => asJson<Calibration>(r)),
  resetCalibration: () =>
    fetch('/api/calibration/reset', { method: 'POST' }).then((r) => asJson<Calibration>(r)),
  reports: () => fetch('/api/reports').then((r) => asJson<ReportSummary[]>(r)),
  report: (id: string) => fetch(`/api/reports/${id}`).then((r) => asJson<AnalysisReport>(r)),
  deleteReport: (id: string) =>
    fetch(`/api/reports/${id}`, { method: 'DELETE' }).then((r) => asJson<{ ok: true }>(r)),
  clearReports: () => fetch('/api/reports', { method: 'DELETE' }).then((r) => asJson<{ ok: true }>(r)),
};
