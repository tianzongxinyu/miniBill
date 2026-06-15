'use client';

import { useEffect, useRef, useState } from 'react';

export function useLoadMoreAnimateIds<T>(
  items: T[],
  loading: boolean,
  loadingMore: boolean,
  getId: (item: T) => number
) {
  const prevCountRef = useRef(0);
  const itemsRef = useRef(items);
  const getIdRef = useRef(getId);
  const [animateIds, setAnimateIds] = useState<Set<number>>(() => new Set());

  itemsRef.current = items;
  getIdRef.current = getId;

  useEffect(() => {
    if (loading) {
      prevCountRef.current = 0;
      setAnimateIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    if (loadingMore) return;

    const list = itemsRef.current;
    const prev = prevCountRef.current;
    if (list.length > prev && prev > 0) {
      const next = new Set<number>();
      for (let i = prev; i < list.length; i++) {
        next.add(getIdRef.current(list[i]));
      }
      setAnimateIds(next);
    } else {
      setAnimateIds((prev) => (prev.size === 0 ? prev : new Set()));
    }
    prevCountRef.current = list.length;
  }, [items.length, loading, loadingMore]);

  return animateIds;
}
