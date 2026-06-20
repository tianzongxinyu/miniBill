'use client';

import { useEffect, useState } from 'react';
import { fetchEarliestMonth, type YearMonth } from '@/lib/api';

export function useEarliestMonth(): YearMonth | null {
  const [earliest, setEarliest] = useState<YearMonth | null>(null);

  useEffect(() => {
    fetchEarliestMonth().then(setEarliest).catch(() => setEarliest(null));
  }, []);

  return earliest;
}
