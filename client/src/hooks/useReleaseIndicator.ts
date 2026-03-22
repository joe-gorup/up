import { useState, useEffect, useCallback } from 'react';
import { CURRENT_RELEASE } from '../lib/releaseConfig';

const TTL_MS = 24 * 60 * 60 * 1000;

interface StoredRelease {
  version: string;
  firstSeenAt: number;
}

export function useReleaseIndicator(userId?: string) {
  const key = userId ? `gs-release-${userId}` : null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      const stored: StoredRelease | null = raw ? JSON.parse(raw) : null;

      if (!stored || stored.version !== CURRENT_RELEASE) {
        localStorage.setItem(key, JSON.stringify({ version: CURRENT_RELEASE, firstSeenAt: Date.now() }));
        setVisible(true);
      } else {
        setVisible((Date.now() - stored.firstSeenAt) < TTL_MS);
      }
    } catch {}
  }, [key]);

  const dismiss = useCallback(() => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({ version: CURRENT_RELEASE, firstSeenAt: 0 }));
    } catch {}
    setVisible(false);
  }, [key]);

  return { visible, dismiss };
}
