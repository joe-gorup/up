import { useEffect } from 'react';
import { useData } from '../contexts/DataContext';

export function useProgressData() {
  const data = useData();
  useEffect(() => { data.ensureProgressLoaded(); }, [data.ensureProgressLoaded]);
  return data;
}
