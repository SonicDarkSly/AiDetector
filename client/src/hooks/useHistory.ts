import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { ReportSummary } from '../types';

export function useHistory() {
  const [items, setItems] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.reports());
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    items,
    loading,
    refresh,
    remove: async (id: string) => {
      await api.deleteReport(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
    },
    clear: async () => {
      await api.clearReports();
      setItems([]);
    },
  };
}
