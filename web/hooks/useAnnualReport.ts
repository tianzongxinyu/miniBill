'use client';

import { useEffect, useState } from 'react';
import { fetchAnnualReport } from '@/lib/api/stats';
import type { AnnualReport } from '@/lib/annualReportTypes';

export function useAnnualReport(year: number | null) {
  const [report, setReport] = useState<AnnualReport | null>(null);
  const [loading, setLoading] = useState(year != null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (year == null) {
      setReport(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAnnualReport(year)
      .then((data) => {
        if (cancelled) return;
        setReport(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setReport(null);
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  return { report, loading, error };
}
